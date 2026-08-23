import { describe, expect, it } from "vitest";
import {
  createMemberSchema,
  patchMemberSchema,
  statusHistorySchema,
  unitHistorySchema,
  cursorQuerySchema,
} from "../src/lib/member/schemas";
import { assertMutationRequest } from "../src/lib/member/security";
import { MemberError } from "../src/lib/member/errors";
import { MemberService } from "../src/lib/member/service";
import type { D1MemberRepository } from "../src/lib/member/repository";
import { authorize } from "../src/lib/auth/policy";
import {
  capabilitiesFor,
  hasGlobalUnitAccess,
} from "../src/lib/auth/capabilities";
import type { AuditEvent, AuditWriter } from "../src/lib/auth/audit";
import type { Principal, Role } from "../src/lib/auth/types";
class Audit implements AuditWriter {
  events: AuditEvent[] = [];
  async write(e: AuditEvent) {
    this.events.push(e);
  }
}
const principal = (
  roles: Role[],
  units = ["00000000-0000-4000-8000-000000000001"],
): Principal => {
  const capabilities = capabilitiesFor(roles);
  return {
    actorId: "00000000-0000-4000-8000-000000000010",
    accessSubject: "synthetic",
    status: "ACTIVE",
    roles,
    capabilities,
    unitScopes: units.map((unitId) => ({
      unitId,
      validFrom: "2026-01-01T00:00:00.000Z",
      validTo: null,
    })),
    globalUnitRead: hasGlobalUnitAccess(capabilities),
    createdAt: "2026-08-22T00:00:00.000Z",
  };
};
describe("I2 strict contracts", () => {
  it("accepts synthetic member input and rejects excess fields", () => {
    expect(
      createMemberSchema.parse({
        employeeRef: "SYN-001",
        displayName: "合成 太郎",
        joinedOn: "2026-01-01",
        primaryUnitStartedOn: "2026-01-01",
      }),
    ).toBeTruthy();
    expect(() =>
      createMemberSchema.parse({
        employeeRef: "SYN-001",
        displayName: "合成",
        joinedOn: "2026-01-01",
        primaryUnitStartedOn: "2026-01-01",
        secret: "no",
      }),
    ).toThrow();
  });
  it("requires optimistic version and valid period ordering", () => {
    expect(() => patchMemberSchema.parse({ displayName: "更新" })).toThrow();
    expect(() =>
      unitHistorySchema.parse({
        unitId: "00000000-0000-4000-8000-000000000001",
        isPrimary: false,
        startedOn: "2026-03-02",
        endedOn: "2026-03-01",
        version: 1,
      }),
    ).toThrow();
    expect(
      statusHistorySchema.parse({
        status: "LEFT",
        startedOn: "2026-03-01",
        reasonCode: "COMPANY_LEFT",
        version: 2,
      }).status,
    ).toBe("LEFT");
  });
  it("enforces cursor defaults and maximum", () => {
    expect(cursorQuerySchema.parse({}).limit).toBe(25);
    expect(() => cursorQuerySchema.parse({ limit: "101" })).toThrow();
  });
  it.each(["<script>alert(1)</script>", "x' OR 1=1 --"])(
    "treats metacharacters as bounded plain data: %s",
    (displayName) =>
      expect(
        createMemberSchema.parse({
          employeeRef: "SYN",
          displayName,
          joinedOn: "2026-01-01",
          primaryUnitStartedOn: "2026-01-01",
        }).displayName,
      ).toBe(displayName),
  );
});
describe("browser mutation boundary", () => {
  const valid = () =>
    new Request(
      "https://app.invalid/api/v1/members/00000000-0000-4000-8000-000000000099",
      {
        method: "PATCH",
        headers: {
          origin: "https://app.invalid",
          "content-type": "application/json",
          "sec-fetch-site": "same-origin",
          cookie: `cc_csrf=${"a".repeat(32)}`,
          "x-csrf-token": "a".repeat(32),
        },
        body: "{}",
      },
    );
  it("accepts same-origin JSON with double-submit token", () =>
    expect(() => assertMutationRequest(valid())).not.toThrow());
  it.each([
    { origin: "https://evil.invalid", "content-type": "application/json" },
    { origin: "https://app.invalid", "content-type": "text/plain" },
    { origin: "https://app.invalid", "content-type": "application/json" },
  ])("rejects CSRF/content-type bypass", (headers) =>
    expect(() =>
      assertMutationRequest(
        new Request("https://app.invalid/api/v1/members/x", {
          method: "PATCH",
          headers,
          body: "{}",
        }),
      ),
    ).toThrow(MemberError),
  );
});
describe("I2 authorization matrix", () => {
  it("allows UL scoped write but conceals another Unit", async () => {
    const a = new Audit(),
      p = principal(["UL"]);
    await authorize(
      p,
      {
        capability: "UNIT_EDIT_SCOPED",
        resourceUnitId: p.unitScopes[0]!.unitId,
        concealExistence: true,
        targetType: "member",
      },
      a,
      "request_ok",
    );
    await expect(
      authorize(
        p,
        {
          capability: "UNIT_EDIT_SCOPED",
          resourceUnitId: "00000000-0000-4000-8000-000000000002",
          concealExistence: true,
          targetType: "member",
        },
        a,
        "request_no",
      ),
    ).rejects.toMatchObject({ status: 404 });
    expect(a.events[0]?.reason).toBe("unit_scope_denied");
  });
  it("allows EXEC global read and rejects all source writes", async () => {
    const a = new Audit(),
      p = principal(["EXECUTIVE"], []);
    await authorize(
      p,
      {
        capability: "UNIT_READ_ALL",
        resourceUnitId: "any",
        targetType: "unit",
      },
      a,
      "read",
    );
    await expect(
      authorize(
        p,
        {
          capability: "UNIT_EDIT_SCOPED",
          resourceUnitId: "any",
          targetType: "member",
        },
        a,
        "write",
      ),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("requires an audited reason for SYSTEM_ADMIN maintenance", async () => {
    const a = new Audit(),
      p = principal(["SYSTEM_ADMIN"], []);
    await expect(
      authorize(
        p,
        {
          capability: "BUSINESS_EDIT_MAINTENANCE",
          resourceUnitId: "any",
          targetType: "member",
        },
        a,
        "no_reason",
      ),
    ).rejects.toMatchObject({ reason: "maintenance_reason_required" });
    await authorize(
      p,
      {
        capability: "BUSINESS_EDIT_MAINTENANCE",
        resourceUnitId: "any",
        targetType: "member",
        maintenanceReason: "synthetic repair ticket",
      },
      a,
      "reason",
    );
    expect(a.events.at(-1)).toMatchObject({
      eventType: "MAINTENANCE_BYPASS",
      reason: "synthetic repair ticket",
    });
  });
  it("does not let composite global read bypass scoped write", async () => {
    const a = new Audit(),
      p = principal(["UL", "EXECUTIVE"]);
    await expect(
      authorize(
        p,
        {
          capability: "UNIT_EDIT_SCOPED",
          resourceUnitId: "other",
          concealExistence: true,
          targetType: "member",
        },
        a,
        "composite",
      ),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe("failed history audit boundary", () => {
  it("does not write a success audit when the atomic repository operation fails", async () => {
    const audit = new Audit();
    const p = principal(["UL"]);
    const repo = {
      findMember: async () => ({
        id: "00000000-0000-4000-8000-000000000020",
        primaryUnitId: p.unitScopes[0]!.unitId,
      }),
      addStatusHistory: async () => {
        throw new MemberError("PERIOD_CONFLICT", 409, "history_conflict");
      },
    } as unknown as D1MemberRepository;
    const service = new MemberService(repo, audit);

    await expect(
      service.statusHistory(
        p,
        "00000000-0000-4000-8000-000000000020",
        {
          status: "LEFT",
          startedOn: "2026-03-01",
          reasonCode: "SYN_LEFT",
          version: 1,
        },
        "request_failed_history",
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(
      audit.events.some(
        (event) => event.eventType === "MEMBER_STATUS_HISTORY_ADDED",
      ),
    ).toBe(false);
  });
});
