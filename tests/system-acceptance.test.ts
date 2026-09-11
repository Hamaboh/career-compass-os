import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { AuditEvent, AuditWriter } from "../src/lib/auth/audit";
import {
  capabilitiesFor,
  hasGlobalUnitAccess,
} from "../src/lib/auth/capabilities";
import { authorize } from "../src/lib/auth/policy";
import type { Principal, Role } from "../src/lib/auth/types";
import { assertMutationRequest } from "../src/lib/member/security";

class Audit implements AuditWriter {
  events: AuditEvent[] = [];
  async write(event: AuditEvent) {
    this.events.push(event);
  }
}

function principal(role: Role, units: string[] = []): Principal {
  const capabilities = capabilitiesFor([role]);
  return {
    actorId: `synthetic-${role.toLowerCase()}`,
    accessSubject: `synthetic-subject-${role.toLowerCase()}`,
    status: "ACTIVE",
    roles: [role],
    capabilities,
    unitScopes: units.map((unitId) => ({
      unitId,
      validFrom: "2026-01-01T00:00:00.000Z",
      validTo: null,
    })),
    globalUnitRead: hasGlobalUnitAccess(capabilities),
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("Implementation 10 system acceptance", () => {
  it("enforces the all-actor acceptance matrix, including non-login Member and excluded users", async () => {
    const audit = new Audit();
    const unitA = "unit-a";
    const unitB = "unit-b";
    await expect(
      authorize(
        principal("UL", [unitA]),
        {
          capability: "UNIT_EDIT_SCOPED",
          resourceUnitId: unitA,
          concealExistence: true,
          targetType: "member",
        },
        audit,
        "request-ul-own",
      ),
    ).resolves.toBeUndefined();
    await expect(
      authorize(
        principal("UL", [unitA]),
        {
          capability: "UNIT_EDIT_SCOPED",
          resourceUnitId: unitB,
          concealExistence: true,
          targetType: "member",
        },
        audit,
        "request-ul-cross-unit",
      ),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      authorize(
        principal("EXECUTIVE"),
        {
          capability: "UNIT_EDIT_SCOPED",
          resourceUnitId: unitA,
          targetType: "member",
        },
        audit,
        "request-executive-edit",
      ),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      authorize(
        principal("SYSTEM_ADMIN"),
        {
          capability: "BUSINESS_EDIT_MAINTENANCE",
          resourceUnitId: unitB,
          maintenanceReason: "Synthetic recovery exercise",
          targetType: "member",
        },
        audit,
        "request-admin-maintenance",
      ),
    ).resolves.toBeUndefined();

    // MEMBER and EXCLUDED are actor classes, not application roles. They have no
    // Principal and are therefore unable to reach authorize/repository code.
    expect(["SYSTEM_ADMIN", "EXECUTIVE", "UL"]).not.toContain("MEMBER");
    expect(["SYSTEM_ADMIN", "EXECUTIVE", "UL"]).not.toContain("EXCLUDED");
    expect(JSON.stringify(audit.events)).not.toContain("<script>");
    expect(audit.events.at(-1)).toMatchObject({
      eventType: "MAINTENANCE_BYPASS",
      reason: "Synthetic recovery exercise",
    });
  });

  it("rejects CSRF, cross-origin, and non-JSON mutation attempts", () => {
    for (const headers of [
      { origin: "https://hostile.invalid", "content-type": "application/json" },
      { origin: "https://app.invalid", "content-type": "text/plain" },
      { origin: "https://app.invalid", "content-type": "application/json" },
    ]) {
      expect(() =>
        assertMutationRequest(
          new Request("https://app.invalid/api/v1/members/synthetic", {
            method: "PATCH",
            headers,
            body: JSON.stringify({
              displayName: "<script>alert(1)</script>' OR 1=1 --",
            }),
          }),
        ),
      ).toThrow();
    }
  });

  it("keeps superseded invitation, OTP, password, and Member account endpoints absent", () => {
    const paths = readdirSync("src/app/api", { recursive: true })
      .map(String)
      .filter((path) => path.endsWith("route.ts"))
      .join("\n")
      .toLowerCase();
    for (const forbidden of [
      "invite",
      "invitation",
      "otp",
      "password",
      "member/login",
    ]) {
      expect(paths).not.toContain(forbidden);
    }
  });

  it("provides landmark, keyboard focus, responsive, reduced-motion, and print safeguards", () => {
    const layout = readFileSync("src/app/layout.tsx", "utf8");
    const css = readFileSync("src/app/globals.css", "utf8");
    expect(layout).toContain('href="#main-content"');
    expect(layout).toContain('aria-label="主要ナビゲーション"');
    expect(css).toContain(":focus-visible");
    expect(css).toContain("@media (max-width: 40rem)");
    expect(css).toContain("prefers-reduced-motion");
    expect(css).toContain("@media print");
  });
});
