import { describe, expect, it } from "vitest";
import { authenticate } from "../src/lib/auth/authenticate";
import {
  capabilitiesFor,
  hasGlobalUnitAccess,
} from "../src/lib/auth/capabilities";
import {
  recordAccessChange,
  type AuditEvent,
  type AuditWriter,
} from "../src/lib/auth/audit";
import { AuthError } from "../src/lib/auth/errors";
import {
  createSyntheticAccessToken,
  FakeAccessJwtVerifier,
} from "../src/lib/auth/fake-verifier";
import { authorize, repositoryUnitScope } from "../src/lib/auth/policy";
import type { AppUserRepository } from "../src/lib/auth/repository";
import type { AppUserIdentity, Principal, Role } from "../src/lib/auth/types";
import {
  AuthenticationConfigurationError,
  createAccessJwtVerifier,
} from "../src/lib/auth/verifier-factory";

const now = new Date("2026-08-22T12:00:00.000Z");
const issuer = "https://synthetic.cloudflareaccess.invalid";
const audience = "career-compass-ci";
const token = (
  overrides: Partial<Parameters<typeof createSyntheticAccessToken>[0]> = {},
) =>
  createSyntheticAccessToken({
    subject: "synthetic-subject",
    issuer,
    audience,
    now,
    ...overrides,
  });
const request = (value?: string) =>
  new Request(
    "https://app.invalid/api/v1/me",
    value ? { headers: { "cf-access-jwt-assertion": value } } : {},
  );
const user = (
  roles: Role[] = ["UL"],
  status: AppUserIdentity["status"] = "ACTIVE",
): AppUserIdentity => ({
  id: "user-synthetic",
  accessSubject: "synthetic-subject",
  emailNormalized: "user@example.invalid",
  displayName: "Synthetic UL",
  status,
  roles,
  unitScopes: [
    { unitId: "unit-a", validFrom: "2026-01-01T00:00:00.000Z", validTo: null },
  ],
});
class Users implements AppUserRepository {
  constructor(public current: AppUserIdentity | null) {}
  async findCurrentBySubject() {
    return this.current;
  }
}
class Audit implements AuditWriter {
  events: AuditEvent[] = [];
  async write(event: AuditEvent) {
    this.events.push(event);
  }
}
const verifier = () => new FakeAccessJwtVerifier(issuer, audience);

describe("Access authentication boundary", () => {
  it("accepts a valid synthetic RS256-shaped token and normalizes management email", async () => {
    const claims = await verifier().verify(
      token({ email: "  USER@Example.Invalid " }),
      now,
    );
    expect(claims).toMatchObject({
      subject: "synthetic-subject",
      algorithm: "RS256",
      tokenType: "JWT",
      keyId: "synthetic-key",
      emailNormalized: "user@example.invalid",
    });
  });
  it.each([
    ["missing", undefined],
    ["malformed", "not-a-jwt"],
    ["expired", token({ expiresInSeconds: -60 })],
    ["issuer mismatch", token({ issuer: "https://wrong.invalid" })],
    ["audience mismatch", token({ audience: "wrong" })],
    ["not before", token({ notBeforeOffsetSeconds: 120 })],
  ])("rejects %s tokens", async (_name, value) => {
    await expect(
      authenticate(request(value), verifier(), new Users(user()), now),
    ).rejects.toBeInstanceOf(AuthError);
  });
  it.each([
    [null, "unregistered"],
    [user(["UL"], "SUSPENDED"), "suspended"],
    [user(["UL"], "REVOKED"), "revoked"],
  ] as const)("rejects app user %s as %s", async (identity, state) => {
    expect(state).toBeTruthy();
    await expect(
      authenticate(request(token()), verifier(), new Users(identity), now),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("builds a fresh principal from current role and scope on every request", async () => {
    const users = new Users(user(["UL"]));
    const first = await authenticate(request(token()), verifier(), users, now);
    users.current = { ...user(["EXECUTIVE"]), unitScopes: [] };
    const second = await authenticate(request(token()), verifier(), users, now);
    expect(first.principal.roles).toEqual(["UL"]);
    expect(second.principal.roles).toEqual(["EXECUTIVE"]);
    expect(second.principal.globalUnitRead).toBe(true);
  });
  it.each([
    ["missing", []],
    [
      "expired",
      [
        {
          unitId: "unit-a",
          validFrom: "2026-01-01T00:00:00.000Z",
          validTo: "2026-08-22T11:59:59.000Z",
        },
      ],
    ],
    [
      "not started",
      [
        {
          unitId: "unit-a",
          validFrom: "2026-08-22T12:00:01.000Z",
          validTo: null,
        },
      ],
    ],
  ] as const)(
    "rejects a scoped UL whose scope is %s",
    async (_state, unitScopes) => {
      await expect(
        authenticate(
          request(token()),
          verifier(),
          new Users({ ...user(), unitScopes: [...unitScopes] }),
          now,
        ),
      ).rejects.toMatchObject({ status: 403, reason: "unit_scope_required" });
    },
  );
  it.each(["EXECUTIVE", "SYSTEM_ADMIN"] as const)(
    "allows global %s without a Unit scope",
    async (role) => {
      const result = await authenticate(
        request(token()),
        verifier(),
        new Users({ ...user([role]), unitScopes: [] }),
        now,
      );
      expect(result.principal.globalUnitRead).toBe(true);
    },
  );
  it("allows a composite UL and EXECUTIVE without a Unit scope based on global capability", async () => {
    const result = await authenticate(
      request(token()),
      verifier(),
      new Users({ ...user(["UL", "EXECUTIVE"]), unitScopes: [] }),
      now,
    );
    expect(result.principal.globalUnitRead).toBe(true);
  });
  it("rejects fake authentication in production without exposing configuration", () => {
    expect(() =>
      createAccessJwtVerifier({
        APP_ENV: "production",
        AUTH_MODE: "fake",
        ACCESS_ISSUER: issuer,
        ACCESS_AUDIENCE: audience,
      }),
    ).toThrow(AuthenticationConfigurationError);
    try {
      createAccessJwtVerifier({
        APP_ENV: "production",
        AUTH_MODE: "fake",
        ACCESS_ISSUER: issuer,
        ACCESS_AUDIENCE: audience,
      });
    } catch (error) {
      expect(String(error)).not.toContain(issuer);
      expect(String(error)).not.toContain(audience);
    }
  });
  it.each(["local", "ci", "preview"] as const)(
    "permits explicitly configured fake authentication in %s",
    (APP_ENV) => {
      expect(
        createAccessJwtVerifier({
          APP_ENV,
          AUTH_MODE: "fake",
          ACCESS_ISSUER: issuer,
          ACCESS_AUDIENCE: audience,
        }),
      ).toBeInstanceOf(FakeAccessJwtVerifier);
    },
  );
});

function principal(role: Role | Role[], unitScopes = ["unit-a"]): Principal {
  const actorRoles = Array.isArray(role) ? role : [role];
  const capabilities = capabilitiesFor(actorRoles);
  return {
    actorId: `actor-${actorRoles.join("-")}`,
    accessSubject: "subject",
    status: "ACTIVE",
    roles: actorRoles,
    capabilities,
    unitScopes: unitScopes.map((unitId) => ({
      unitId,
      validFrom: now.toISOString(),
      validTo: null,
    })),
    globalUnitRead: hasGlobalUnitAccess(capabilities),
    createdAt: now.toISOString(),
  };
}

describe("central authorization policy", () => {
  it("allows SYSTEM_ADMIN and EXECUTIVE global read, and rejects EXECUTIVE edit", async () => {
    const audit = new Audit();
    await authorize(
      principal("SYSTEM_ADMIN"),
      {
        capability: "UNIT_READ_ALL",
        resourceUnitId: "unit-z",
        targetType: "unit",
      },
      audit,
      "request_admin",
    );
    await authorize(
      principal("EXECUTIVE"),
      {
        capability: "UNIT_READ_ALL",
        resourceUnitId: "unit-z",
        targetType: "unit",
      },
      audit,
      "request_exec",
    );
    await expect(
      authorize(
        principal("EXECUTIVE"),
        {
          capability: "UNIT_EDIT_SCOPED",
          resourceUnitId: "unit-z",
          targetType: "unit",
        },
        audit,
        "request_edit",
      ),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("allows UL self-unit read/edit and conceals guessed cross-unit IDs", async () => {
    const audit = new Audit();
    const ul = principal("UL");
    await authorize(
      ul,
      {
        capability: "UNIT_READ_SCOPED",
        resourceUnitId: "unit-a",
        targetType: "unit",
      },
      audit,
      "request_read",
    );
    await authorize(
      ul,
      {
        capability: "UNIT_EDIT_SCOPED",
        resourceUnitId: "unit-a",
        targetType: "unit",
      },
      audit,
      "request_edit",
    );
    await expect(
      authorize(
        ul,
        {
          capability: "UNIT_READ_SCOPED",
          resourceUnitId: "guessed-unit",
          concealExistence: true,
          targetType: "unit",
          targetId: "guessed-id",
        },
        audit,
        "request_cross",
      ),
    ).rejects.toMatchObject({ status: 404, reason: "unit_scope_denied" });
    expect(audit.events.at(-1)).toMatchObject({
      eventType: "AUTHORIZATION_DENIED",
      reason: "unit_scope_denied",
      requestId: "request_cross",
    });
    expect(repositoryUnitScope(ul)).toEqual({
      global: false,
      unitIds: ["unit-a"],
    });
  });
  it.each([
    ["EXECUTIVE", "UL"],
    ["SYSTEM_ADMIN", "UL"],
  ] as Role[][])(
    "does not let composite global role %s bypass scoped writes",
    async (...roles) => {
      const actor = principal(roles, ["unit-a"]);
      await authorize(
        actor,
        {
          capability: "UNIT_EDIT_SCOPED",
          resourceUnitId: "unit-a",
          targetType: "unit",
        },
        new Audit(),
        "request_own_write",
      );
      await expect(
        authorize(
          actor,
          {
            capability: "UNIT_EDIT_SCOPED",
            resourceUnitId: "unit-b",
            targetType: "unit",
          },
          new Audit(),
          "request_cross_write",
        ),
      ).rejects.toMatchObject({ status: 403, reason: "unit_scope_denied" });
    },
  );
  it("requires a maintenance reason and audits an allowed bypass", async () => {
    const audit = new Audit();
    const admin = principal("SYSTEM_ADMIN");
    await expect(
      authorize(
        admin,
        {
          capability: "BUSINESS_EDIT_MAINTENANCE",
          targetType: "record",
        },
        audit,
        "request_no_reason",
      ),
    ).rejects.toMatchObject({ code: "MAINTENANCE_REASON_REQUIRED" });
    await expect(
      authorize(
        admin,
        {
          capability: "BUSINESS_EDIT_MAINTENANCE",
          maintenanceReason: "   ",
          targetType: "record",
        },
        audit,
        "request_blank_reason",
      ),
    ).rejects.toMatchObject({ code: "MAINTENANCE_REASON_REQUIRED" });
    await authorize(
      admin,
      {
        capability: "BUSINESS_EDIT_MAINTENANCE",
        maintenanceReason: "synthetic recovery check",
        resourceUnitId: "unit-outside-admin-scope",
        targetType: "record",
        targetId: "record-1",
      },
      audit,
      "request_reason",
    );
    expect(audit.events.at(-1)).toMatchObject({
      eventType: "MAINTENANCE_BYPASS",
      reason: "synthetic recovery check",
    });
  });
  it("records role, scope, and activation changes without body or secrets", async () => {
    const audit = new Audit();
    for (const eventType of [
      "ROLE_GRANTED",
      "ROLE_REVOKED",
      "UNIT_SCOPE_GRANTED",
      "UNIT_SCOPE_REVOKED",
      "APP_USER_ACTIVATED",
      "APP_USER_DEACTIVATED",
    ] as const)
      await recordAccessChange(audit, {
        eventType,
        actorId: "admin",
        targetType: "app_user",
        targetId: "target",
        reason: "synthetic change",
        requestId: "request_change",
        metadata: { role: "UL" },
      });
    expect(audit.events).toHaveLength(6);
    expect(JSON.stringify(audit.events)).not.toMatch(
      /jwt|cookie|secret|stack|body|sql/i,
    );
  });
});
