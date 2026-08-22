import { describe, expect, it } from "vitest";
import { createMeHandler } from "../src/lib/auth/me-handler";
import {
  createSyntheticAccessToken,
  FakeAccessJwtVerifier,
} from "../src/lib/auth/fake-verifier";
import type { AppUserRepository } from "../src/lib/auth/repository";
import type { AppUserIdentity } from "../src/lib/auth/types";

const now = new Date("2026-08-22T12:00:00.000Z");
const issuer = "https://synthetic.cloudflareaccess.invalid";
const audience = "career-compass-ci";
const active: AppUserIdentity = {
  id: "actor-1",
  accessSubject: "subject-1",
  emailNormalized: "synthetic@example.invalid",
  displayName: "Synthetic User",
  status: "ACTIVE",
  roles: ["UL"],
  unitScopes: [
    { unitId: "unit-a", validFrom: now.toISOString(), validTo: null },
  ],
};
class Users implements AppUserRepository {
  constructor(private readonly value: AppUserIdentity | null) {}
  async findCurrentBySubject() {
    return this.value;
  }
}
const jwt = createSyntheticAccessToken({
  subject: "subject-1",
  issuer,
  audience,
  now,
});
const call = (identity: AppUserIdentity | null, token?: string) =>
  createMeHandler({
    verifier: new FakeAccessJwtVerifier(issuer, audience),
    users: new Users(identity),
    now: () => now,
  })(
    new Request(
      "https://app.invalid/api/v1/me",
      token
        ? {
            headers: {
              "cf-access-jwt-assertion": token,
              "x-request-id": "request_123",
            },
          }
        : { headers: { "x-request-id": "request_123" } },
    ),
  );

describe("GET /api/v1/me integration", () => {
  it("returns the formal success envelope and minimum profile", async () => {
    const response = await call(active, jwt);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: {
        actorId: "actor-1",
        status: "ACTIVE",
        roles: ["UL"],
        unitScopes: active.unitScopes,
        capabilities: ["PROFILE_READ", "UNIT_READ_SCOPED", "UNIT_EDIT_SCOPED"],
        profile: { displayName: "Synthetic User" },
      },
      meta: { requestId: "request_123", nextCursor: null },
    });
  });
  it.each([
    ["missing JWT", active, undefined, 401],
    ["invalid JWT", active, "sensitive.jwt.value", 401],
    ["unregistered", null, jwt, 403],
    ["inactive", { ...active, status: "SUSPENDED" as const }, jwt, 403],
  ] as const)(
    "returns a safe envelope for %s",
    async (_name, identity, tokenValue, status) => {
      const response = await call(identity, tokenValue);
      expect(response.status).toBe(status);
      const serialized = JSON.stringify(await response.json());
      expect(serialized).toContain("request_123");
      expect(serialized).not.toContain(tokenValue ?? "never-match");
      expect(serialized).not.toMatch(/stack|secret|sql|cookie/i);
    },
  );
});
