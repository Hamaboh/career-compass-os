import { describe, expect, it } from "vitest";
import type { Principal } from "../src/lib/auth/types";
import { adminRepository, auditRepository } from "../src/lib/admin/http";
import {
  aiPolicyInput,
  auditExportInput,
  auditQueryInput,
  retentionApproveInput,
  userAccessInput,
} from "../src/lib/admin/schemas";
import { AdminRepository } from "../src/lib/admin/repository";
import { assertOperationalWriteAvailable } from "../src/lib/member/http";

const files = {} as R2Bucket;
const db = {} as D1Database;
const runtime = { db, privateFiles: files, verifier: {} } as never;
const admin = {
  actorId: "admin-a",
  accessSubject: "admin-subject",
  status: "ACTIVE",
  roles: ["SYSTEM_ADMIN"],
  capabilities: [
    "USER_ACCESS_MANAGE",
    "AUDIT_READ_ALL",
    "AI_CONFIG_MANAGE",
    "RETENTION_MANAGE",
    "BACKUP_MANAGE",
    "OPERATIONS_READ",
  ],
  unitScopes: [],
  globalUnitRead: true,
  createdAt: "2026-01-01T00:00:00.000Z",
} as Principal;
const executive = {
  actorId: "executive-a",
  accessSubject: "executive-subject",
  status: "ACTIVE",
  roles: ["EXECUTIVE"],
  capabilities: ["UNIT_READ_ALL", "AUDIT_READ_SCOPED"],
  unitScopes: [],
  globalUnitRead: true,
  createdAt: "2026-01-01T00:00:00.000Z",
} as Principal;
const ul = {
  actorId: "ul-a",
  accessSubject: "ul-subject",
  status: "ACTIVE",
  roles: ["UL"],
  capabilities: ["UNIT_READ_SCOPED", "AUDIT_READ_SCOPED"],
  unitScopes: [{ unitId: "unit-a", validFrom: "2026-01-01", validTo: null }],
  globalUnitRead: false,
  createdAt: "2026-01-01T00:00:00.000Z",
} as Principal;

describe("Implementation 9 admin boundaries", () => {
  it("blocks business writes during maintenance while preserving admin recovery", async () => {
    const maintenanceDb = {
      prepare: () => ({
        bind: () => ({ first: async () => ({ maintenance_mode: 1 }) }),
      }),
    } as unknown as D1Database;
    await expect(
      assertOperationalWriteAvailable(
        new Request("https://app.invalid/api/v1/members", { method: "POST" }),
        maintenanceDb,
      ),
    ).rejects.toMatchObject({ status: 503, code: "DEPENDENCY_UNAVAILABLE" });
    await expect(
      assertOperationalWriteAvailable(
        new Request("https://app.invalid/api/v1/admin/backups", {
          method: "POST",
        }),
        maintenanceDb,
      ),
    ).resolves.toBeUndefined();
  });

  it("allows only SYSTEM_ADMIN to mutate user access, AI, retention and backup", () => {
    for (const capability of [
      "USER_ACCESS_MANAGE",
      "AI_CONFIG_MANAGE",
      "RETENTION_MANAGE",
      "BACKUP_MANAGE",
      "OPERATIONS_READ",
    ] as const) {
      expect(adminRepository(runtime, admin, capability)).toBeDefined();
      expect(() => adminRepository(runtime, executive, capability)).toThrow(
        /RESOURCE_NOT_FOUND/,
      );
      expect(() => adminRepository(runtime, ul, capability)).toThrow(
        /RESOURCE_NOT_FOUND/,
      );
    }
  });

  it("allows scoped audit search but never grants audit export capability", () => {
    expect(auditRepository(runtime, admin)).toBeDefined();
    expect(auditRepository(runtime, executive)).toBeDefined();
    expect(auditRepository(runtime, ul)).toBeDefined();
    expect(() =>
      adminRepository(runtime, executive, "OPERATIONS_READ"),
    ).toThrow();
  });

  it("requires UL access records to retain at least one Unit scope", () => {
    expect(() =>
      userAccessInput.parse({
        version: 1,
        status: "ACTIVE",
        roles: ["UL"],
        unitIds: [],
        reason: "Synthetic change",
      }),
    ).toThrow(/Unit scope/);
  });

  it("rejects unknown privilege fields instead of accepting caller-defined capabilities", () => {
    expect(() =>
      userAccessInput.parse({
        version: 1,
        status: "ACTIVE",
        roles: ["UL"],
        unitIds: ["00000000-0000-4000-8000-000000000001"],
        capabilities: ["AUDIT_READ_ALL"],
        reason: "Synthetic escalation",
      }),
    ).toThrow();
  });

  it("requires optimistic versions and explicit reasons for AI policy changes", () => {
    expect(() =>
      aiPolicyInput.parse({ enabled: false, monthlyCapMicrounits: 1 }),
    ).toThrow();
    expect(
      aiPolicyInput.parse({
        version: 1,
        enabled: false,
        monthlyCapMicrounits: 1,
        reason: "Synthetic incident",
      }),
    ).toMatchObject({ enabled: false });
  });

  it("requires the exact retention preview hash and version", () => {
    expect(() => retentionApproveInput.parse({ version: 1 })).toThrow();
    expect(() =>
      retentionApproveInput.parse({ version: 1, previewHash: "a".repeat(63) }),
    ).toThrow();
  });

  it("limits audit pages and rejects malformed cursors", () => {
    expect(auditQueryInput.parse({ limit: "100" }).limit).toBe(100);
    expect(() => auditQueryInput.parse({ limit: "101" })).toThrow();
    expect(() => auditQueryInput.parse({ cursor: "../secret" })).toThrow();
    expect(() =>
      auditQueryInput.parse({
        from: "2025-01-01T00:00:00.000Z",
        to: "2026-06-01T00:00:00.000Z",
      }),
    ).toThrow(/366日/);
  });

  it("requires bounded audit export periods", () => {
    expect(() =>
      auditExportInput.parse({
        from: "2026-01-01T00:00:00.000Z",
        to: "2026-03-01T00:00:00.000Z",
      }),
    ).toThrow(/31日/);
    expect(
      auditExportInput.parse({
        from: "2026-01-01T00:00:00.000Z",
        to: "2026-01-31T00:00:00.000Z",
      }).limit,
    ).toBe(1000);
  });

  it("conceals another Unit audit query from a UL before issuing SQL", async () => {
    const repository = new AdminRepository(db, files);
    await expect(
      repository.searchAudit(
        ul,
        auditQueryInput.parse({
          unitId: "00000000-0000-4000-8000-000000000002",
        }),
        "request-a",
      ),
    ).rejects.toMatchObject({ status: 404, code: "RESOURCE_NOT_FOUND" });
  });

  it("applies Unit predicates in the repository for UL audit reads", async () => {
    const issued: string[] = [];
    const scopedDb = {
      prepare(sql: string) {
        issued.push(sql);
        return {
          bind() {
            return this;
          },
          async all() {
            return { results: [] };
          },
          async run() {
            return { meta: { changes: 1 } };
          },
        };
      },
    } as unknown as D1Database;
    await new AdminRepository(scopedDb, files).searchAudit(
      ul,
      auditQueryInput.parse({ limit: 25 }),
      "request-a",
    );
    expect(issued[0]).toContain("h.unit_id IN");
    expect(issued[0]).toContain("p.unit_id IN");
    expect(issued[0]).toContain("v.confidentiality='NORMAL'");
    expect(issued[0]).toContain("record_access_grants");
    expect(issued[0]).toContain("a.target_type='goal'");
    expect(issued[0]).toContain("q.executive_visible=1");
    expect(issued[0]).toContain("a.target_type='goal_version'");
    expect(issued[0]).not.toContain("metadata_json");
    expect(issued[0]).not.toContain("reason");
  });

  it("scans every declared retention data class without auto-executing it", async () => {
    const issued: string[] = [];
    const retentionDb = {
      prepare(sql: string) {
        issued.push(sql);
        return {
          bind() {
            return this;
          },
          async first() {
            return null;
          },
          async all() {
            return { results: [] };
          },
          async run() {
            return { meta: { changes: 1 } };
          },
        };
      },
      async batch() {
        return [];
      },
    } as unknown as D1Database;
    await new AdminRepository(retentionDb, files).scanRetention(
      admin,
      {
        asOf: "2026-09-01T00:00:00.000Z",
        idempotencyKey: "retention-scan-2026-09-01",
      },
      "request-retention-scan",
    );
    const sql = issued.join("\n");
    expect(sql).toContain("FROM ai_suggestions");
    expect(sql).toContain("FROM share_tokens");
    expect(sql).toContain("FROM backup_exports");
    expect(sql).toContain("FROM audit_events");
    expect(sql).toContain("FROM members");
    expect(sql).toContain("NOT EXISTS(SELECT 1 FROM ai_adopted_drafts");
  });

  it("builds a recoverable row artifact rather than a counts-only manifest", async () => {
    const backupDb = {
      prepare(sql: string) {
        return {
          async all() {
            if (sql.startsWith("SELECT * FROM "))
              return { results: [{ synthetic: sql.slice(14) }] };
            return { results: [{ object_key: "private/synthetic" }] };
          },
        };
      },
    } as unknown as D1Database;
    const repository = new AdminRepository(backupDb, files) as unknown as {
      backupManifest(sourceTimestamp: string): Promise<{
        format: string;
        counts: Record<string, number>;
        tables: Record<string, Record<string, unknown>[]>;
      }>;
    };
    const artifact = await repository.backupManifest(
      "2026-09-01T00:00:00.000Z",
    );
    expect(artifact.format).toBe("CAREER_COMPASS_RECOVERABLE_BACKUP_V2");
    expect(artifact.counts.members).toBe(1);
    expect(artifact.tables.members).toEqual([{ synthetic: "members" }]);
    expect(artifact.tables.audit_events).toHaveLength(1);
  });
});
