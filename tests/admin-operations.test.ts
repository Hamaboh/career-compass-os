import { describe, expect, it } from "vitest";
import type { Principal } from "../src/lib/auth/types";
import { adminRepository, auditRepository } from "../src/lib/admin/http";
import {
  aiPolicyInput,
  auditExportInput,
  auditQueryInput,
  retentionApproveInput,
  restoreExerciseInput,
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
    expect(issued[0]).toContain("date(a.occurred_at)>=date(h.started_on)");
    expect(issued[0]).toContain(
      "h.ended_on IS NULL OR date(a.occurred_at)<date(h.ended_on)",
    );
    expect(issued[0]).not.toContain("date(a.occurred_at)<=date(h.ended_on)");
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
        return { sql };
      },
      async batch(statements: Array<{ sql: string }>) {
        return statements.map(({ sql }) =>
          sql.startsWith("SELECT * FROM ")
            ? { results: [{ synthetic: sql.slice(14) }] }
            : { results: [{ object_key: "fixture" }] },
        );
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
    expect(artifact.tables.share_access_windows).toHaveLength(1);
  });

  it("collects every backup table in one transactional D1 batch", async () => {
    let batches = 0;
    const snapshotDb = {
      prepare(sql: string) {
        return { sql };
      },
      async batch(statements: Array<{ sql: string }>) {
        batches += 1;
        expect(statements.length).toBeGreaterThan(2);
        return statements.map(() => ({ results: [] }));
      },
    } as unknown as D1Database;
    await (
      new AdminRepository(snapshotDb, files) as unknown as {
        backupManifest(value: string): Promise<unknown>;
      }
    ).backupManifest("2026-09-01T00:00:00.000Z");
    expect(batches).toBe(1);
  });

  it("returns an approved member action to reapproval when its preview changed", async () => {
    let deletes = 0;
    let batches = 0;
    const retentionDb = {
      prepare(sql: string) {
        return {
          sql,
          bind() {
            return this;
          },
          async first() {
            if (sql.includes("FROM retention_actions WHERE id="))
              return {
                id: "action-a",
                subject_type: "MEMBER",
                subject_id: "member-a",
                status: "APPROVED",
                preview_hash: "0".repeat(64),
                approved_by: "admin-b",
                version: 2,
              };
            return null;
          },
        };
      },
      async batch(statements: Array<{ sql?: string }>) {
        batches += 1;
        if (batches === 1)
          return statements.map(() => ({
            results: [{ count: 1 }],
            meta: { changes: 0 },
          }));
        expect(statements[0]?.sql).toContain("status='CANDIDATE'");
        return statements.map(() => ({ results: [], meta: { changes: 1 } }));
      },
    } as unknown as D1Database;
    const guardedFiles = {
      delete: async () => {
        deletes += 1;
      },
    } as unknown as R2Bucket;
    await expect(
      new AdminRepository(retentionDb, guardedFiles).executeRetention(
        admin,
        "action-a",
        { version: 2, previewHash: "0".repeat(64) },
        "request-a",
      ),
    ).rejects.toMatchObject({
      status: 409,
      reason: "retention_preview_changed_reapproval_required",
    });
    expect(deletes).toBe(0);
  });

  it("orders restore timestamps chronologically across offsets", () => {
    const base = {
      environment: "LOCAL" as const,
      restoredArtifactChecksum: "a".repeat(64),
      restoredCounts: { members: 0 },
      authorizationSmokeVerified: true,
      notes: "synthetic",
    };
    expect(() =>
      restoreExerciseInput.parse({
        ...base,
        startedAt: "2026-09-11T10:00:00+09:00",
        completedAt: "2026-09-11T02:00:00Z",
      }),
    ).not.toThrow();
    expect(() =>
      restoreExerciseInput.parse({
        ...base,
        startedAt: "2026-09-11T02:00:00Z",
        completedAt: "2026-09-11T10:00:00+09:00",
      }),
    ).toThrow(/完了日時/);
  });

  it("reclaims a FAILED backup with the same idempotency key and object key", async () => {
    const writes: string[] = [];
    const issued: string[] = [];
    const sourceTimestamp = new Date().toISOString();
    const retryDb = {
      prepare(sql: string) {
        issued.push(sql);
        return {
          bind() {
            return this;
          },
          async first() {
            if (sql.includes("FROM backup_exports WHERE created_by="))
              return {
                id: "backup-a",
                environment: "PREVIEW",
                status: "FAILED",
                object_key: "backups/preview/existing.json",
                source_timestamp: sourceTimestamp,
              };
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
      async batch(statements: unknown[]) {
        return statements.map(() => ({ results: [], meta: { changes: 1 } }));
      },
    } as unknown as D1Database;
    const retryFiles = {
      put: async (key: string) => {
        writes.push(key);
      },
    } as unknown as R2Bucket;
    await new AdminRepository(retryDb, retryFiles).createBackupExport(
      admin,
      {
        environment: "PREVIEW",
        sourceTimestamp,
        idempotencyKey: "daily-preview",
      },
      "request-retry",
    );
    expect(writes).toEqual(["backups/preview/existing.json"]);
    expect(
      issued.some(
        (sql) =>
          sql.includes("status='PENDING'") && sql.includes("status='FAILED'"),
      ),
    ).toBe(true);
    expect(
      issued.some((sql) => sql.startsWith("INSERT INTO backup_exports")),
    ).toBe(false);
  });
});
