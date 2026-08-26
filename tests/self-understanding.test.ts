import { describe, expect, it } from "vitest";
import {
  entryInput,
  sessionInput,
  visionInput,
} from "../src/lib/self-understanding/schemas";
import { authorize } from "../src/lib/auth/policy";
import {
  capabilitiesFor,
  hasGlobalUnitAccess,
} from "../src/lib/auth/capabilities";
import type { AuditEvent, AuditWriter } from "../src/lib/auth/audit";
import type { Principal, Role } from "../src/lib/auth/types";
class Audit implements AuditWriter {
  events: AuditEvent[] = [];
  async write(event: AuditEvent) {
    this.events.push(event);
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
    createdAt: "2026-01-01T00:00:00.000Z",
  };
};
const normal = {
  confidentiality: "NORMAL" as const,
  visibility: "UL_AND_EXEC" as const,
  aiSendPolicy: "AI_SEND_ALLOWED" as const,
};
describe("I3 strict provenance and state contracts", () => {
  it("distinguishes every non-answer state from an empty answer", () => {
    for (const responseStatus of [
      "UNANSWERED",
      "UNKNOWN",
      "DECLINED",
      "ON_HOLD",
      "SKIPPED",
    ] as const)
      expect(
        entryInput.parse({
          responseStatus,
          responseText: null,
          provenanceType: "MEMBER_STATEMENT",
          ...normal,
        }).responseStatus,
      ).toBe(responseStatus);
    expect(() =>
      entryInput.parse({
        responseStatus: "ANSWERED",
        responseText: null,
        provenanceType: "MEMBER_STATEMENT",
        ...normal,
      }),
    ).toThrow();
  });
  it("rejects extra fields and invalid confidentiality combinations", () => {
    expect(() =>
      sessionInput.parse({ routeType: "EXPLORE", unexpected: true }),
    ).toThrow();
    expect(() =>
      entryInput.parse({
        responseStatus: "ANSWERED",
        responseText: "synthetic",
        provenanceType: "UL_OBSERVATION",
        confidentiality: "CONFIDENTIAL",
        visibility: "UL_AND_EXEC",
        aiSendPolicy: "AI_SEND_ALLOWED",
      }),
    ).toThrow();
  });
  it("never treats a hypothesis as member-confirmed", () => {
    expect(() =>
      visionInput.parse({
        kind: "FUTURE_VISION",
        statement: "synthetic direction",
        status: "MEMBER_CONFIRMED",
        provenanceType: "AI_HYPOTHESIS",
        evidenceEntryIds: [],
        expectedVersion: 0,
        ...normal,
      }),
    ).toThrow();
    expect(
      visionInput.parse({
        kind: "VALUE",
        statement: "synthetic value",
        status: "HYPOTHESIS",
        provenanceType: "UL_OBSERVATION",
        evidenceEntryIds: [],
        expectedVersion: 0,
        ...normal,
      }).status,
    ).toBe("HYPOTHESIS");
  });
});
describe("I3 authorization boundary", () => {
  it("allows a UL scoped write and conceals another Unit", async () => {
    const audit = new Audit(),
      ul = principal(["UL"]);
    await authorize(
      ul,
      {
        capability: "UNIT_EDIT_SCOPED",
        resourceUnitId: ul.unitScopes[0]!.unitId,
        concealExistence: true,
        targetType: "self_analysis",
      },
      audit,
      "own",
    );
    await expect(
      authorize(
        ul,
        {
          capability: "UNIT_EDIT_SCOPED",
          resourceUnitId: "00000000-0000-4000-8000-000000000002",
          concealExistence: true,
          targetType: "self_analysis",
        },
        audit,
        "other",
      ),
    ).rejects.toMatchObject({ status: 404, reason: "unit_scope_denied" });
  });
  it("allows EXEC global read and rejects source mutation", async () => {
    const audit = new Audit(),
      exec = principal(["EXECUTIVE"], []);
    await authorize(
      exec,
      {
        capability: "UNIT_READ_ALL",
        resourceUnitId: "00000000-0000-4000-8000-000000000002",
        targetType: "self_analysis",
      },
      audit,
      "read",
    );
    await expect(
      authorize(
        exec,
        {
          capability: "UNIT_EDIT_SCOPED",
          resourceUnitId: "00000000-0000-4000-8000-000000000002",
          targetType: "self_analysis",
        },
        audit,
        "write",
      ),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("requires a reason for SYSTEM_ADMIN maintenance and audits the allowance", async () => {
    const audit = new Audit(),
      admin = principal(["SYSTEM_ADMIN"], []);
    await expect(
      authorize(
        admin,
        {
          capability: "BUSINESS_EDIT_MAINTENANCE",
          resourceUnitId: "00000000-0000-4000-8000-000000000002",
          targetType: "self_analysis",
        },
        audit,
        "missing",
      ),
    ).rejects.toMatchObject({ reason: "maintenance_reason_required" });
    await authorize(
      admin,
      {
        capability: "BUSINESS_EDIT_MAINTENANCE",
        resourceUnitId: "00000000-0000-4000-8000-000000000002",
        maintenanceReason: "synthetic repair reference",
        targetType: "self_analysis",
      },
      audit,
      "reason",
    );
    expect(audit.events.at(-1)).toMatchObject({
      eventType: "MAINTENANCE_BYPASS",
      reason: "synthetic repair reference",
    });
  });
});
