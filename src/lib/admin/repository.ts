import type { z } from "zod";
import type { Principal } from "../auth/types";
import { MemberError } from "../member/errors";
import type {
  aiPolicyInput,
  auditExportInput,
  auditQueryInput,
  backupExportInput,
  incidentSwitchInput,
  quotaInput,
  restoreExerciseInput,
  retentionApproveInput,
  retentionScanInput,
  userAccessInput,
  userCreateInput,
} from "./schemas";

type Files = Pick<R2Bucket, "get" | "put" | "delete">;
type Row = Record<string, unknown>;
type BackupManifest = {
  format: string;
  schemaVersion: string;
  sourceTimestamp: string;
  counts: Record<string, number>;
  r2Keys: string[];
};

const BACKUP_TABLES = [
  "app_users",
  "units",
  "members",
  "goals",
  "goal_versions",
  "progress_entries",
  "reflections",
  "one_on_ones",
  "one_on_one_entries",
  "ai_requests",
  "ai_suggestions",
  "share_snapshots",
  "audit_events",
] as const;

async function sha256(value: string) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function isoPlusDays(value: string, days: number) {
  return new Date(new Date(value).getTime() + days * 86_400_000).toISOString();
}

function isoPlusYears(value: string, years: number) {
  const date = new Date(value);
  date.setUTCFullYear(date.getUTCFullYear() + years);
  return date.toISOString();
}

export class AdminRepository {
  constructor(
    private readonly db: D1Database,
    private readonly files: Files,
  ) {}

  private audit(
    eventType: string,
    principal: Principal,
    targetType: string,
    targetId: string,
    requestId: string,
    now: string,
    metadata: Record<string, string | number | boolean | null> = {},
    predicate = "1=1",
    predicateBindings: unknown[] = [],
  ) {
    return this.db
      .prepare(
        `INSERT INTO audit_events(id,event_type,occurred_at,actor_id,target_type,target_id,outcome,reason,request_id,metadata_json)
         SELECT ?,?,?,?,?,?,'SUCCEEDED','operation_succeeded',?,? WHERE ${predicate}`,
      )
      .bind(
        crypto.randomUUID(),
        eventType,
        now,
        principal.actorId,
        targetType,
        targetId,
        requestId,
        JSON.stringify(metadata),
        ...predicateBindings,
      );
  }

  async dashboard() {
    const [
      settings,
      aiPolicies,
      aiUsage,
      jobs,
      retention,
      backups,
      drills,
      quota,
    ] = await Promise.all([
      this.db
        .prepare("SELECT * FROM operational_settings WHERE id='global'")
        .first<Row>(),
      this.db
        .prepare(
          "SELECT id,operation,provider,model_alias,enabled,monthly_cap_microunits,retention_status,training_status,version,updated_at FROM model_policies ORDER BY operation",
        )
        .all<Row>(),
      this.db
        .prepare(
          "SELECT month,operation,COUNT(*) request_count,COALESCE(SUM(CASE WHEN status='SETTLED' THEN actual_microunits ELSE estimated_microunits END),0) used_microunits FROM ai_budget_ledger WHERE status IN ('RESERVED','SETTLED') GROUP BY month,operation ORDER BY month DESC,operation",
        )
        .all<Row>(),
      this.db
        .prepare(
          "SELECT status,COUNT(*) count,MAX(attempts) max_attempts,MIN(next_attempt_at) oldest_due FROM jobs GROUP BY status ORDER BY status",
        )
        .all<Row>(),
      this.db
        .prepare(
          "SELECT status,COUNT(*) count,MIN(due_at) oldest_due FROM retention_actions GROUP BY status ORDER BY status",
        )
        .all<Row>(),
      this.db
        .prepare(
          "SELECT id,environment,status,schema_version,manifest_checksum,source_timestamp,expires_at,created_at FROM backup_exports ORDER BY created_at DESC LIMIT 25",
        )
        .all<Row>(),
      this.db
        .prepare(
          "SELECT id,backup_export_id,environment,status,started_at,completed_at,rpo_hours,rto_minutes,schema_verified,counts_verified,r2_refs_verified,authorization_smoke_verified,created_at FROM restore_exercises ORDER BY created_at DESC LIMIT 25",
        )
        .all<Row>(),
      this.db
        .prepare(
          "SELECT id,environment,workers_percent,d1_percent,r2_percent,source,recorded_at FROM quota_snapshots ORDER BY recorded_at DESC LIMIT 25",
        )
        .all<Row>(),
    ]);
    return {
      settings,
      aiPolicies: aiPolicies.results,
      aiUsage: aiUsage.results,
      jobs: jobs.results,
      retention: retention.results,
      backups: backups.results,
      restoreExercises: drills.results,
      quota: quota.results,
      thresholds: {
        aiWarningPercent: 80,
        aiStopPercent: 100,
        infrastructureWarningPercent: 80,
        rpoHours: 24,
        rtoMinutes: 1440,
        backupRetentionDays: 30,
        auditRetentionYears: 3,
        memberAnonymizationYears: 1,
      },
      notice:
        "運用値は人物評価ではありません。AI停止中も既存データの手動業務は継続できます。",
    };
  }

  async listUsers() {
    const [users, units] = await Promise.all([
      this.db
        .prepare(
          `SELECT u.id,u.access_subject,u.email_normalized,u.display_name,u.status,u.last_login_at,u.updated_at,
          COALESCE(v.version,1) version,
          COALESCE((SELECT json_group_array(r.code) FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=u.id AND ur.valid_to IS NULL),'[]') roles_json,
          COALESCE((SELECT json_group_array(s.unit_id) FROM user_unit_scopes s WHERE s.user_id=u.id AND s.valid_to IS NULL),'[]') unit_ids_json
          FROM app_users u LEFT JOIN app_user_access_versions v ON v.user_id=u.id ORDER BY u.email_normalized`,
        )
        .all<Row>(),
      this.db
        .prepare("SELECT id,code,name,status FROM units ORDER BY code")
        .all<Row>(),
    ]);
    return { users: users.results, units: units.results };
  }

  private async validateUnits(unitIds: string[]) {
    if (unitIds.length === 0) return;
    const result = await this.db
      .prepare(
        `SELECT COUNT(*) count FROM units WHERE status='ACTIVE' AND id IN (${unitIds.map(() => "?").join(",")})`,
      )
      .bind(...unitIds)
      .first<{ count: number }>();
    if ((result?.count ?? 0) !== new Set(unitIds).size)
      throw new MemberError("VALIDATION_ERROR", 422, "active_unit_required");
  }

  async createUser(
    principal: Principal,
    input: z.infer<typeof userCreateInput>,
    requestId: string,
  ) {
    const unitIds = [...new Set(input.unitIds)];
    const roleCodes = [...new Set(input.roles)];
    await this.validateUnits(unitIds);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    try {
      await this.db.batch([
        this.db
          .prepare(
            "INSERT INTO app_users(id,access_subject,email_normalized,display_name,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
          )
          .bind(
            id,
            input.accessSubject,
            input.email,
            input.displayName,
            input.status,
            now,
            now,
          ),
        this.db
          .prepare(
            "INSERT INTO app_user_access_versions(user_id,version,updated_at) VALUES(?,1,?)",
          )
          .bind(id, now),
        ...roleCodes.map((role) =>
          this.db
            .prepare(
              "INSERT INTO user_roles(id,user_id,role_id,valid_from,valid_to,granted_by) SELECT ?,?,id,?,NULL,? FROM roles WHERE code=?",
            )
            .bind(crypto.randomUUID(), id, now, principal.actorId, role),
        ),
        ...unitIds.map((unitId) =>
          this.db
            .prepare(
              "INSERT INTO user_unit_scopes(id,user_id,unit_id,scope_type,valid_from,valid_to,granted_by) VALUES(?,?,?,'EXPLICIT',?,NULL,?)",
            )
            .bind(crypto.randomUUID(), id, unitId, now, principal.actorId),
        ),
        this.audit(
          "APP_USER_CREATED",
          principal,
          "app_user",
          id,
          requestId,
          now,
          {
            reason: input.reason,
            roleCount: roleCodes.length,
            unitScopeCount: unitIds.length,
          },
        ),
      ]);
    } catch {
      throw new MemberError("VERSION_CONFLICT", 409, "user_create_conflict");
    }
    return this.listUsers();
  }

  async updateUserAccess(
    principal: Principal,
    userId: string,
    input: z.infer<typeof userAccessInput>,
    requestId: string,
  ) {
    const unitIds = [...new Set(input.unitIds)];
    const roleCodes = [...new Set(input.roles)];
    await this.validateUnits(unitIds);
    const now = new Date().toISOString();
    const current = await this.db
      .prepare(
        "SELECT u.id,u.status,v.version FROM app_users u JOIN app_user_access_versions v ON v.user_id=u.id WHERE u.id=?",
      )
      .bind(userId)
      .first<{ id: string; status: string; version: number }>();
    if (!current)
      throw new MemberError("RESOURCE_NOT_FOUND", 404, "user_not_found");
    const tokenPredicate =
      "EXISTS(SELECT 1 FROM app_user_access_versions v WHERE v.user_id=? AND v.version=? AND v.updated_at=?)";
    const statements = [
      this.db
        .prepare(
          "UPDATE app_user_access_versions SET version=version+1,updated_at=? WHERE user_id=? AND version=?",
        )
        .bind(now, userId, input.version),
      this.db
        .prepare(
          `UPDATE app_users SET status=?,updated_at=? WHERE id=? AND ${tokenPredicate}`,
        )
        .bind(input.status, now, userId, userId, input.version + 1, now),
      this.db
        .prepare(
          `UPDATE user_roles SET valid_to=? WHERE user_id=? AND valid_to IS NULL AND role_id NOT IN (SELECT id FROM roles WHERE code IN (${roleCodes.map(() => "?").join(",")})) AND ${tokenPredicate}`,
        )
        .bind(now, userId, ...roleCodes, userId, input.version + 1, now),
      this.db
        .prepare(
          `UPDATE user_unit_scopes SET valid_to=? WHERE user_id=? AND valid_to IS NULL AND unit_id NOT IN (${unitIds.map(() => "?").join(",") || "NULL"}) AND ${tokenPredicate}`,
        )
        .bind(now, userId, ...unitIds, userId, input.version + 1, now),
      ...roleCodes.map((role) =>
        this.db
          .prepare(
            `INSERT INTO user_roles(id,user_id,role_id,valid_from,valid_to,granted_by)
             SELECT ?,?,r.id,?,NULL,? FROM roles r WHERE r.code=? AND ${tokenPredicate}
             AND NOT EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id=? AND ur.role_id=r.id AND ur.valid_to IS NULL)`,
          )
          .bind(
            crypto.randomUUID(),
            userId,
            now,
            principal.actorId,
            role,
            userId,
            input.version + 1,
            now,
            userId,
          ),
      ),
      ...unitIds.map((unitId) =>
        this.db
          .prepare(
            `INSERT INTO user_unit_scopes(id,user_id,unit_id,scope_type,valid_from,valid_to,granted_by)
             SELECT ?,?,?,'EXPLICIT',?,NULL,? WHERE ${tokenPredicate}
             AND NOT EXISTS(SELECT 1 FROM user_unit_scopes s WHERE s.user_id=? AND s.unit_id=? AND s.valid_to IS NULL)`,
          )
          .bind(
            crypto.randomUUID(),
            userId,
            unitId,
            now,
            principal.actorId,
            userId,
            input.version + 1,
            now,
            userId,
            unitId,
          ),
      ),
      this.audit(
        "USER_ACCESS_CHANGED",
        principal,
        "app_user",
        userId,
        requestId,
        now,
        {
          reason: input.reason,
          status: input.status,
          roles: roleCodes.join(","),
          unitScopeCount: unitIds.length,
        },
        tokenPredicate,
        [userId, input.version + 1, now],
      ),
    ];
    try {
      const result = await this.db.batch(statements);
      if ((result[0]?.meta.changes ?? 0) !== 1)
        throw new MemberError("VERSION_CONFLICT", 409, "user_access_stale");
    } catch (error) {
      if (error instanceof MemberError) throw error;
      throw new MemberError("VERSION_CONFLICT", 409, "user_access_conflict");
    }
    return this.listUsers();
  }

  async updateAiPolicy(
    principal: Principal,
    policyId: string,
    input: z.infer<typeof aiPolicyInput>,
    requestId: string,
  ) {
    const now = new Date().toISOString();
    const result = await this.db.batch([
      this.db
        .prepare(
          "UPDATE model_policies SET enabled=?,monthly_cap_microunits=?,version=version+1,updated_at=? WHERE id=? AND version=? AND provider='DETERMINISTIC_FAKE'",
        )
        .bind(
          input.enabled ? 1 : 0,
          input.monthlyCapMicrounits,
          now,
          policyId,
          input.version,
        ),
      this.audit(
        "AI_POLICY_CHANGED",
        principal,
        "model_policy",
        policyId,
        requestId,
        now,
        { reason: input.reason, enabled: input.enabled },
        "changes()=1",
      ),
    ]);
    if ((result[0]?.meta.changes ?? 0) !== 1)
      throw new MemberError("VERSION_CONFLICT", 409, "ai_policy_stale");
    return this.dashboard();
  }

  async updateIncidentSwitches(
    principal: Principal,
    input: z.infer<typeof incidentSwitchInput>,
    requestId: string,
  ) {
    const now = new Date().toISOString();
    const result = await this.db.batch([
      this.db
        .prepare(
          "UPDATE operational_settings SET maintenance_mode=?,ai_incident_disabled=?,share_incident_disabled=?,mail_incident_disabled=?,incident_reason=?,version=version+1,updated_by=?,updated_at=? WHERE id='global' AND version=?",
        )
        .bind(
          input.maintenanceMode ? 1 : 0,
          input.aiDisabled ? 1 : 0,
          input.shareDisabled ? 1 : 0,
          input.mailDisabled ? 1 : 0,
          input.reason,
          principal.actorId,
          now,
          input.version,
        ),
      this.audit(
        "INCIDENT_SWITCH_CHANGED",
        principal,
        "operational_settings",
        "global",
        requestId,
        now,
        { reason: input.reason },
        "changes()=1",
      ),
    ]);
    if ((result[0]?.meta.changes ?? 0) !== 1)
      throw new MemberError("VERSION_CONFLICT", 409, "incident_switch_stale");
    return this.dashboard();
  }

  async searchAudit(
    principal: Principal,
    query: z.infer<typeof auditQueryInput>,
    requestId: string,
  ) {
    const unitIds = principal.unitScopes.map((scope) => scope.unitId);
    if (
      query.unitId &&
      !principal.globalUnitRead &&
      !unitIds.includes(query.unitId)
    )
      throw new MemberError(
        "RESOURCE_NOT_FOUND",
        404,
        "audit_scope_not_visible",
      );
    const filters: string[] = [];
    const bindings: unknown[] = [];
    const add = (sql: string, value: unknown) => {
      filters.push(sql);
      bindings.push(value);
    };
    if (query.from) add("a.occurred_at>=?", query.from);
    if (query.to) add("a.occurred_at<=?", query.to);
    if (query.actorId) add("a.actor_id=?", query.actorId);
    if (query.eventType) add("a.event_type=?", query.eventType);
    if (query.subjectType) add("a.target_type=?", query.subjectType);
    if (query.outcome) add("a.outcome=?", query.outcome);
    if (query.requestId) add("a.request_id=?", query.requestId);
    if (query.cursor) {
      let cursor: { occurredAt: string; id: string };
      try {
        const encoded = query.cursor.replaceAll("-", "+").replaceAll("_", "/");
        cursor = JSON.parse(
          atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "=")),
        ) as typeof cursor;
      } catch {
        throw new MemberError("VALIDATION_ERROR", 422, "audit_cursor_invalid");
      }
      if (!cursor.occurredAt || !cursor.id)
        throw new MemberError("VALIDATION_ERROR", 422, "audit_cursor_invalid");
      filters.push("(a.occurred_at<? OR (a.occurred_at=? AND a.id<?))");
      bindings.push(cursor.occurredAt, cursor.occurredAt, cursor.id);
    }
    if (!principal.capabilities.includes("AUDIT_READ_ALL")) {
      const executive = principal.roles.includes("EXECUTIVE");
      filters.push(`(
        a.actor_id=? OR
        (a.target_type='member' AND EXISTS(SELECT 1 FROM members m WHERE m.id=a.target_id)) OR
        (a.target_type='goal' AND EXISTS(
          SELECT 1 FROM goals g JOIN goal_versions v ON v.id=g.current_version_id
          WHERE g.id=a.target_id AND (
            (v.confidentiality='NORMAL' AND v.visibility='UL_AND_EXEC') OR
            g.created_by=? OR EXISTS(
              SELECT 1 FROM record_access_grants acl
              WHERE acl.resource_type='GOAL_VERSION' AND acl.resource_id=v.id AND acl.actor_id=?
                AND (acl.expires_at IS NULL OR acl.expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now'))
            )
          )
        ) AND (
          a.event_type NOT IN ('GOAL_PROGRESS_RECORDED','GOAL_REFLECTION_RECORDED','SUPPORT_PROPOSALS_CREATED')
          OR a.actor_id=?
        )) OR
        (a.target_type='one_on_one' AND EXISTS(
          SELECT 1 FROM one_on_ones o WHERE o.id=a.target_id AND (o.ul_user_id=? OR ?)
        )) OR
        (a.target_type='one_on_one_entry' AND EXISTS(
          SELECT 1 FROM one_on_one_entries e
          WHERE e.id=a.target_id AND (
            (e.confidentiality='NORMAL' AND e.entry_type<>'RAW_NOTE') OR
            e.created_by=? OR EXISTS(
              SELECT 1 FROM record_access_grants acl
              WHERE acl.resource_type='ONE_ON_ONE_ENTRY' AND acl.resource_id=e.id AND acl.actor_id=?
                AND (acl.expires_at IS NULL OR acl.expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now'))
            )
          )
        )) OR
        (a.target_type='self_understanding' AND (
          EXISTS(SELECT 1 FROM self_analysis_sessions s WHERE s.id=a.target_id) OR
          EXISTS(SELECT 1 FROM self_analysis_questions q JOIN self_analysis_sessions s ON s.id=q.session_id WHERE q.id=a.target_id) OR
          EXISTS(
            SELECT 1 FROM self_analysis_entries e
            WHERE e.id=a.target_id AND (
              (e.confidentiality='NORMAL' AND e.visibility='UL_AND_EXEC') OR e.created_by=? OR EXISTS(
                SELECT 1 FROM record_access_grants acl
                WHERE acl.resource_type='SELF_ANALYSIS_ENTRY' AND acl.resource_id=e.id AND acl.actor_id=?
                  AND (acl.expires_at IS NULL OR acl.expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now'))
              )
            )
          ) OR
          EXISTS(
            SELECT 1 FROM future_vision_versions v
            WHERE v.id=a.target_id AND (
              (v.confidentiality='NORMAL' AND v.visibility='UL_AND_EXEC') OR v.created_by=? OR EXISTS(
                SELECT 1 FROM record_access_grants acl
                WHERE acl.resource_type='FUTURE_VISION_VERSION' AND acl.resource_id=v.id AND acl.actor_id=?
                  AND (acl.expires_at IS NULL OR acl.expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now'))
              )
            )
          )
        )) OR
        (a.target_type='ai_request' AND EXISTS(
          SELECT 1 FROM ai_requests q WHERE q.id=a.target_id
          AND (q.actor_id=? OR (? AND q.executive_visible=1 AND q.status='SUCCEEDED'))
        )) OR
        (a.target_type='share_snapshot' AND EXISTS(
          SELECT 1 FROM share_snapshots s WHERE s.id=a.target_id AND s.created_by=?
        )) OR
        (a.target_type='share_token' AND EXISTS(
          SELECT 1 FROM share_tokens t JOIN share_snapshots s ON s.id=t.snapshot_id
          WHERE t.id=a.target_id AND s.created_by=?
        )) OR
        (a.target_type='reminder_rule' AND EXISTS(
          SELECT 1 FROM reminder_rules r WHERE r.id=a.target_id
          AND (r.created_by=? OR r.recipient_user_id=?)
        )) OR
        (a.target_type='notification' AND EXISTS(
          SELECT 1 FROM notifications n WHERE n.id=a.target_id AND n.recipient_user_id=?
        )) OR
        (a.target_type='review' AND EXISTS(
          SELECT 1 FROM review_requests r WHERE r.id=a.target_id
          AND (r.requested_by=? OR r.assigned_to=? OR ?)
        ))
      )`);
      bindings.push(
        principal.actorId,
        principal.actorId,
        principal.actorId,
        principal.actorId,
        principal.actorId,
        executive ? 1 : 0,
        principal.actorId,
        principal.actorId,
        principal.actorId,
        principal.actorId,
        principal.actorId,
        principal.actorId,
        principal.actorId,
        executive ? 1 : 0,
        principal.actorId,
        principal.actorId,
        principal.actorId,
        principal.actorId,
        principal.actorId,
        principal.actorId,
        principal.actorId,
        executive ? 1 : 0,
      );
    }
    const scopeUnitIds = query.unitId ? [query.unitId] : unitIds;
    if (!principal.globalUnitRead) {
      const marks = scopeUnitIds.map(() => "?").join(",") || "NULL";
      filters.push(`(
        (a.target_type='member' AND EXISTS(SELECT 1 FROM members m JOIN member_unit_history h ON h.member_id=m.id WHERE m.id=a.target_id AND h.unit_id IN (${marks}))) OR
        (a.target_type='goal' AND EXISTS(SELECT 1 FROM goals g WHERE g.id=a.target_id AND g.unit_id IN (${marks}))) OR
        (a.target_type='goal_version' AND EXISTS(SELECT 1 FROM goal_versions v JOIN goals g ON g.id=v.goal_id WHERE v.id=a.target_id AND g.unit_id IN (${marks}))) OR
        (a.target_type='progress_entry' AND EXISTS(SELECT 1 FROM progress_entries p WHERE p.id=a.target_id AND p.unit_id IN (${marks}))) OR
        (a.target_type='reflection' AND EXISTS(SELECT 1 FROM reflections r WHERE r.id=a.target_id AND r.unit_id IN (${marks}))) OR
        (a.target_type='one_on_one' AND EXISTS(SELECT 1 FROM one_on_ones o WHERE o.id=a.target_id AND o.unit_id IN (${marks}))) OR
        (a.target_type='one_on_one_entry' AND EXISTS(SELECT 1 FROM one_on_one_entries e JOIN one_on_ones o ON o.id=e.one_on_one_id WHERE e.id=a.target_id AND o.unit_id IN (${marks}))) OR
        (a.target_type='self_understanding' AND EXISTS(SELECT 1 FROM self_analysis_sessions s WHERE s.id=a.target_id AND s.unit_id IN (${marks}))) OR
        (a.target_type='self_understanding' AND EXISTS(SELECT 1 FROM self_analysis_questions q JOIN self_analysis_sessions s ON s.id=q.session_id WHERE q.id=a.target_id AND s.unit_id IN (${marks}))) OR
        (a.target_type='self_understanding' AND EXISTS(SELECT 1 FROM self_analysis_entries e JOIN self_analysis_sessions s ON s.id=e.session_id WHERE e.id=a.target_id AND s.unit_id IN (${marks}))) OR
        (a.target_type='self_understanding' AND EXISTS(SELECT 1 FROM future_vision_versions v WHERE v.id=a.target_id AND v.unit_id IN (${marks}))) OR
        (a.target_type='share_snapshot' AND EXISTS(SELECT 1 FROM share_snapshots s WHERE s.id=a.target_id AND s.unit_id IN (${marks}))) OR
        (a.target_type='share_token' AND EXISTS(SELECT 1 FROM share_tokens t JOIN share_snapshots s ON s.id=t.snapshot_id WHERE t.id=a.target_id AND s.unit_id IN (${marks}))) OR
        (a.target_type='ai_request' AND EXISTS(SELECT 1 FROM ai_requests q WHERE q.id=a.target_id AND q.unit_id IN (${marks}))) OR
        (a.target_type='review' AND EXISTS(SELECT 1 FROM review_requests rr WHERE rr.id=a.target_id AND rr.unit_id IN (${marks}))) OR
        (a.target_type='reminder_rule' AND EXISTS(SELECT 1 FROM reminder_rules r WHERE r.id=a.target_id AND r.unit_id IN (${marks}))) OR
        (a.target_type='notification' AND EXISTS(SELECT 1 FROM notifications n WHERE n.id=a.target_id AND n.unit_id IN (${marks})))
      )`);
      for (let index = 0; index < 17; index += 1)
        bindings.push(...scopeUnitIds);
    } else if (query.unitId) {
      const unitId = query.unitId;
      filters.push(`(
        (a.target_type='member' AND EXISTS(SELECT 1 FROM members m JOIN member_unit_history h ON h.member_id=m.id WHERE m.id=a.target_id AND h.unit_id=?)) OR
        (a.target_type='goal' AND EXISTS(SELECT 1 FROM goals g WHERE g.id=a.target_id AND g.unit_id=?)) OR
        (a.target_type='goal_version' AND EXISTS(SELECT 1 FROM goal_versions v JOIN goals g ON g.id=v.goal_id WHERE v.id=a.target_id AND g.unit_id=?)) OR
        (a.target_type='progress_entry' AND EXISTS(SELECT 1 FROM progress_entries p WHERE p.id=a.target_id AND p.unit_id=?)) OR
        (a.target_type='reflection' AND EXISTS(SELECT 1 FROM reflections r WHERE r.id=a.target_id AND r.unit_id=?)) OR
        (a.target_type='one_on_one' AND EXISTS(SELECT 1 FROM one_on_ones o WHERE o.id=a.target_id AND o.unit_id=?)) OR
        (a.target_type='one_on_one_entry' AND EXISTS(SELECT 1 FROM one_on_one_entries e JOIN one_on_ones o ON o.id=e.one_on_one_id WHERE e.id=a.target_id AND o.unit_id=?)) OR
        (a.target_type='self_understanding' AND EXISTS(SELECT 1 FROM self_analysis_sessions s WHERE s.id=a.target_id AND s.unit_id=?)) OR
        (a.target_type='self_understanding' AND EXISTS(SELECT 1 FROM self_analysis_questions q JOIN self_analysis_sessions s ON s.id=q.session_id WHERE q.id=a.target_id AND s.unit_id=?)) OR
        (a.target_type='self_understanding' AND EXISTS(SELECT 1 FROM self_analysis_entries e JOIN self_analysis_sessions s ON s.id=e.session_id WHERE e.id=a.target_id AND s.unit_id=?)) OR
        (a.target_type='self_understanding' AND EXISTS(SELECT 1 FROM future_vision_versions v WHERE v.id=a.target_id AND v.unit_id=?)) OR
        (a.target_type='share_snapshot' AND EXISTS(SELECT 1 FROM share_snapshots s WHERE s.id=a.target_id AND s.unit_id=?)) OR
        (a.target_type='share_token' AND EXISTS(SELECT 1 FROM share_tokens t JOIN share_snapshots s ON s.id=t.snapshot_id WHERE t.id=a.target_id AND s.unit_id=?)) OR
        (a.target_type='ai_request' AND EXISTS(SELECT 1 FROM ai_requests q WHERE q.id=a.target_id AND q.unit_id=?)) OR
        (a.target_type='review' AND EXISTS(SELECT 1 FROM review_requests rr WHERE rr.id=a.target_id AND rr.unit_id=?)) OR
        (a.target_type='reminder_rule' AND EXISTS(SELECT 1 FROM reminder_rules r WHERE r.id=a.target_id AND r.unit_id=?)) OR
        (a.target_type='notification' AND EXISTS(SELECT 1 FROM notifications n WHERE n.id=a.target_id AND n.unit_id=?))
      )`);
      bindings.push(...Array(17).fill(unitId));
    }
    const result = await this.db
      .prepare(
        `SELECT a.id,a.event_type,a.occurred_at,a.actor_id,a.target_type,a.target_id,a.outcome,a.request_id
         FROM audit_events a ${filters.length ? `WHERE ${filters.join(" AND ")}` : ""}
         ORDER BY a.occurred_at DESC,a.id DESC LIMIT ?`,
      )
      .bind(...bindings, query.limit + 1)
      .all<Row>();
    const page = result.results.slice(0, query.limit);
    const last = page.at(-1) as
      | { occurred_at?: string; id?: string }
      | undefined;
    const nextCursor =
      result.results.length > query.limit && last?.occurred_at && last.id
        ? btoa(JSON.stringify({ occurredAt: last.occurred_at, id: last.id }))
            .replaceAll("+", "-")
            .replaceAll("/", "_")
            .replaceAll("=", "")
        : null;
    const now = new Date().toISOString();
    await this.audit(
      "AUDIT_SEARCHED",
      principal,
      "audit_search",
      requestId,
      requestId,
      now,
      { resultCount: page.length },
    ).run();
    return { events: page, nextCursor };
  }

  async exportAudit(
    principal: Principal,
    query: z.infer<typeof auditExportInput>,
    requestId: string,
  ) {
    const filters = ["occurred_at>=?", "occurred_at<=?"];
    const bindings: unknown[] = [query.from, query.to];
    if (query.eventType) {
      filters.push("event_type=?");
      bindings.push(query.eventType);
    }
    if (query.outcome) {
      filters.push("outcome=?");
      bindings.push(query.outcome);
    }
    const result = await this.db
      .prepare(
        `SELECT event_type,occurred_at,target_type,outcome,request_id
         FROM audit_events WHERE ${filters.join(" AND ")}
         ORDER BY occurred_at DESC,id DESC LIMIT ?`,
      )
      .bind(...bindings, query.limit)
      .all<Row>();
    const now = new Date().toISOString();
    await this.audit(
      "AUDIT_EXPORTED",
      principal,
      "audit_export",
      requestId,
      requestId,
      now,
      { from: query.from, to: query.to, count: result.results.length },
    ).run();
    return {
      generatedAt: now,
      period: { from: query.from, to: query.to },
      events: result.results,
      exclusions: [
        "本文",
        "Member識別子",
        "actor識別子",
        "target識別子",
        "metadata",
        "Prompt",
        "raw token",
        "Secret",
      ],
    };
  }

  private async memberRetentionPreview(memberId: string) {
    const queries = [
      [
        "selfAnalysis",
        "SELECT COUNT(*) count FROM self_analysis_sessions WHERE member_id=?",
      ],
      ["goals", "SELECT COUNT(*) count FROM goals WHERE member_id=?"],
      ["oneOnOnes", "SELECT COUNT(*) count FROM one_on_ones WHERE member_id=?"],
      [
        "aiRequests",
        "SELECT COUNT(*) count FROM ai_requests WHERE member_id=?",
      ],
      [
        "shareSnapshots",
        "SELECT COUNT(*) count FROM share_snapshots WHERE member_id=?",
      ],
    ] as const;
    const counts: Record<string, number> = {};
    for (const [name, sql] of queries) {
      const row = await this.db
        .prepare(sql)
        .bind(memberId)
        .first<{ count: number }>();
      counts[name] = row?.count ?? 0;
    }
    return {
      memberId,
      dataClasses: Object.keys(counts),
      recordCounts: counts,
      statisticsRetained: ["所属履歴", "状態履歴", "集計可能な数値"],
      irreversible: true,
      r2ObjectCount: (counts.shareSnapshots ?? 0) + (counts.aiRequests ?? 0),
    };
  }

  async scanRetention(
    principal: Principal,
    input: z.infer<typeof retentionScanInput>,
    requestId: string,
  ) {
    const existing = await this.db
      .prepare("SELECT id FROM operational_job_runs WHERE dedupe_key=?")
      .bind(`retention:${principal.actorId}:${input.idempotencyKey}`)
      .first<{ id: string }>();
    if (existing) return this.listRetention();
    const [members, auditEvents] = await Promise.all([
      this.db
        .prepare(
          "SELECT id,left_on,status FROM members WHERE status IN ('LEFT','OUT_OF_SCOPE') AND left_on IS NOT NULL AND date(left_on)<=date(?,'-1 year') ORDER BY left_on,id LIMIT 50",
        )
        .bind(input.asOf)
        .all<{ id: string; left_on: string; status: string }>(),
      this.db
        .prepare(
          "SELECT id,event_type,occurred_at,outcome,target_type FROM audit_events WHERE datetime(occurred_at)<=datetime(?,'-3 years') ORDER BY occurred_at,id LIMIT 50",
        )
        .bind(input.asOf)
        .all<{
          id: string;
          event_type: string;
          occurred_at: string;
          outcome: string;
          target_type: string;
        }>(),
    ]);
    const now = new Date().toISOString();
    const statements: D1PreparedStatement[] = [];
    for (const member of members.results) {
      const preview = await this.memberRetentionPreview(member.id);
      const previewJson = JSON.stringify(preview);
      statements.push(
        this.db
          .prepare(
            "INSERT OR IGNORE INTO retention_actions(id,subject_type,subject_id,action,due_at,status,basis,preview_json,preview_hash,candidate_by,version,created_at,updated_at) VALUES(?,'MEMBER',?,'ANONYMIZE',?,'CANDIDATE',?,?,?,?,1,?,?)",
          )
          .bind(
            crypto.randomUUID(),
            member.id,
            isoPlusYears(member.left_on, 1),
            "退職・管理対象外から1年経過",
            previewJson,
            await sha256(previewJson),
            principal.actorId,
            now,
            now,
          ),
      );
    }
    for (const event of auditEvents.results) {
      const previewJson = JSON.stringify({
        auditEventId: event.id,
        eventType: event.event_type,
        occurredAt: event.occurred_at,
        outcome: event.outcome,
        targetType: event.target_type,
        irreversible: true,
      });
      statements.push(
        this.db
          .prepare(
            "INSERT OR IGNORE INTO retention_actions(id,subject_type,subject_id,action,due_at,status,basis,preview_json,preview_hash,candidate_by,version,created_at,updated_at) VALUES(?,'AUDIT_EVENT',?,'DELETE_EXPIRED',?,'CANDIDATE',?,?,?,?,1,?,?)",
          )
          .bind(
            crypto.randomUUID(),
            event.id,
            isoPlusYears(event.occurred_at, 3),
            "監査ログの3年保持期間満了",
            previewJson,
            await sha256(previewJson),
            principal.actorId,
            now,
            now,
          ),
      );
    }
    const candidateCount = members.results.length + auditEvents.results.length;
    statements.push(
      this.db
        .prepare(
          "INSERT INTO operational_job_runs(id,job_type,dedupe_key,status,candidate_count,started_at,completed_at) VALUES(?,'RETENTION_SCAN',?,'SUCCEEDED',?,?,?)",
        )
        .bind(
          crypto.randomUUID(),
          `retention:${principal.actorId}:${input.idempotencyKey}`,
          candidateCount,
          now,
          now,
        ),
      this.audit(
        "RETENTION_SCANNED",
        principal,
        "retention_scan",
        input.idempotencyKey,
        requestId,
        now,
        { candidateCount },
      ),
    );
    try {
      await this.db.batch(statements);
    } catch {
      const raced = await this.db
        .prepare("SELECT id FROM operational_job_runs WHERE dedupe_key=?")
        .bind(`retention:${principal.actorId}:${input.idempotencyKey}`)
        .first<{ id: string }>();
      if (!raced)
        throw new MemberError(
          "VERSION_CONFLICT",
          409,
          "retention_scan_conflict",
        );
    }
    return this.listRetention();
  }

  async listRetention() {
    const result = await this.db
      .prepare(
        "SELECT id,subject_type,subject_id,action,due_at,status,basis,preview_json,preview_hash,approved_by,approved_at,executed_by,executed_at,result_json,version,created_at,updated_at FROM retention_actions ORDER BY due_at,id",
      )
      .all<Row>();
    return result.results;
  }

  async approveRetention(
    principal: Principal,
    actionId: string,
    input: z.infer<typeof retentionApproveInput>,
    requestId: string,
  ) {
    const now = new Date().toISOString();
    const result = await this.db.batch([
      this.db
        .prepare(
          "UPDATE retention_actions SET status='APPROVED',approved_by=?,approved_at=?,version=version+1,updated_at=? WHERE id=? AND status='CANDIDATE' AND version=? AND preview_hash=?",
        )
        .bind(
          principal.actorId,
          now,
          now,
          actionId,
          input.version,
          input.previewHash,
        ),
      this.audit(
        "RETENTION_APPROVED",
        principal,
        "retention_action",
        actionId,
        requestId,
        now,
        {},
        "changes()=1",
      ),
    ]);
    if ((result[0]?.meta.changes ?? 0) !== 1)
      throw new MemberError(
        "VERSION_CONFLICT",
        409,
        "retention_approval_stale",
      );
    return this.listRetention();
  }

  private async retentionObjectKeys(memberId: string) {
    const [shares, evidence, ai] = await Promise.all([
      this.db
        .prepare(
          "SELECT r2_object_key object_key FROM share_snapshots WHERE member_id=?",
        )
        .bind(memberId)
        .all<{ object_key: string }>(),
      Promise.resolve({ results: [] as { object_key: string }[] }),
      this.db
        .prepare(
          "SELECT sanitized_context_cipher_ref object_key FROM ai_requests WHERE member_id=?",
        )
        .bind(memberId)
        .all<{ object_key: string }>(),
    ]);
    return [
      ...new Set(
        [...shares.results, ...evidence.results, ...ai.results].map(
          (row) => row.object_key,
        ),
      ),
    ];
  }

  async executeRetention(
    principal: Principal,
    actionId: string,
    input: z.infer<typeof retentionApproveInput>,
    requestId: string,
  ) {
    const action = await this.db
      .prepare("SELECT * FROM retention_actions WHERE id=?")
      .bind(actionId)
      .first<{
        id: string;
        subject_type: string;
        subject_id: string;
        status: string;
        preview_hash: string;
        approved_by: string | null;
        version: number;
      }>();
    if (!action)
      throw new MemberError(
        "RESOURCE_NOT_FOUND",
        404,
        "retention_action_not_found",
      );
    if (
      !["MEMBER", "AUDIT_EVENT"].includes(action.subject_type) ||
      action.status !== "APPROVED" ||
      action.version !== input.version ||
      action.preview_hash !== input.previewHash
    )
      throw new MemberError(
        "VERSION_CONFLICT",
        409,
        "retention_execution_stale",
      );
    if (action.approved_by === principal.actorId)
      throw new MemberError(
        "PRECONDITION_FAILED",
        409,
        "second_admin_required",
      );
    const backup = await this.db
      .prepare(
        "SELECT id FROM backup_exports WHERE status='READY' AND datetime(source_timestamp)>=datetime('now','-24 hours') ORDER BY source_timestamp DESC LIMIT 1",
      )
      .first<{ id: string }>();
    if (!backup)
      throw new MemberError(
        "PRECONDITION_FAILED",
        409,
        "recent_backup_required",
      );
    const now = new Date().toISOString();
    const claiming = await this.db.batch([
      this.db
        .prepare(
          "UPDATE retention_actions SET status='EXECUTING',executed_by=?,executed_at=?,version=version+1,updated_at=? WHERE id=? AND status='APPROVED' AND version=? AND preview_hash=?",
        )
        .bind(
          principal.actorId,
          now,
          now,
          actionId,
          input.version,
          input.previewHash,
        ),
      this.audit(
        "RETENTION_EXECUTION_STARTED",
        principal,
        "retention_action",
        actionId,
        requestId,
        now,
        { backupExportId: backup.id },
        "changes()=1",
      ),
    ]);
    if ((claiming[0]?.meta.changes ?? 0) !== 1)
      throw new MemberError(
        "VERSION_CONFLICT",
        409,
        "retention_claim_conflict",
      );
    if (action.subject_type === "AUDIT_EVENT") {
      const finish = new Date().toISOString();
      const result = await this.db.batch([
        this.db
          .prepare("DELETE FROM audit_events WHERE id=?")
          .bind(action.subject_id),
        this.db
          .prepare(
            "UPDATE retention_actions SET status='EXECUTED',result_json=?,updated_at=? WHERE id=? AND status='EXECUTING'",
          )
          .bind(
            JSON.stringify({ deleted: true, retainedForYears: 3 }),
            finish,
            actionId,
          ),
        this.audit(
          "RETENTION_EXECUTED",
          principal,
          "retention_action",
          actionId,
          requestId,
          finish,
          { deletedAuditEvent: true, backupExportId: backup.id },
        ),
      ]);
      if ((result[0]?.meta.changes ?? 0) !== 1)
        throw new MemberError(
          "VERSION_CONFLICT",
          409,
          "retention_target_missing",
        );
      return this.listRetention();
    }
    const objectKeys = await this.retentionObjectKeys(action.subject_id);
    try {
      for (const key of objectKeys) await this.files.delete(key);
    } catch {
      const failedAt = new Date().toISOString();
      await this.db.batch([
        this.db
          .prepare(
            "UPDATE retention_actions SET status='FAILED',result_json=?,updated_at=? WHERE id=? AND status='EXECUTING'",
          )
          .bind(
            JSON.stringify({ code: "R2_DELETE_FAILED" }),
            failedAt,
            actionId,
          ),
        this.audit(
          "RETENTION_EXECUTION_FAILED",
          principal,
          "retention_action",
          actionId,
          requestId,
          failedAt,
          { errorCode: "R2_DELETE_FAILED" },
          "changes()=1",
        ),
      ]);
      throw new MemberError(
        "DEPENDENCY_UNAVAILABLE",
        503,
        "retention_r2_failed",
      );
    }
    const retiredRef = `retired:${crypto.randomUUID()}`;
    const memberId = action.subject_id;
    const redacted = "[匿名化済み]";
    const finish = new Date().toISOString();
    await this.db.batch([
      this.db
        .prepare(
          "UPDATE members SET employee_ref=?,display_name='匿名化済み',version=version+1,updated_at=? WHERE id=?",
        )
        .bind(retiredRef, finish, memberId),
      this.db
        .prepare(
          "UPDATE self_analysis_entries SET response_text=CASE WHEN response_status='ANSWERED' THEN ? ELSE NULL END,version=version+1,updated_at=? WHERE session_id IN (SELECT id FROM self_analysis_sessions WHERE member_id=?)",
        )
        .bind(redacted, finish, memberId),
      this.db
        .prepare(
          "UPDATE self_analysis_entry_history SET response_text=CASE WHEN response_status='ANSWERED' THEN ? ELSE NULL END WHERE entry_id IN (SELECT e.id FROM self_analysis_entries e JOIN self_analysis_sessions s ON s.id=e.session_id WHERE s.member_id=?)",
        )
        .bind(redacted, memberId),
      this.db
        .prepare(
          "UPDATE self_analysis_questions SET prompt_text=?,version=version+1,updated_at=? WHERE session_id IN (SELECT id FROM self_analysis_sessions WHERE member_id=?)",
        )
        .bind(redacted, finish, memberId),
      this.db
        .prepare(
          "UPDATE self_analysis_question_history SET prompt_text=? WHERE question_id IN (SELECT q.id FROM self_analysis_questions q JOIN self_analysis_sessions s ON s.id=q.session_id WHERE s.member_id=?)",
        )
        .bind(redacted, memberId),
      this.db
        .prepare(
          "UPDATE future_vision_versions SET statement=? WHERE member_id=?",
        )
        .bind(redacted, memberId),
      this.db
        .prepare(
          "UPDATE goal_versions SET title=?,description='',success_criteria=?,change_reason=NULL WHERE goal_id IN (SELECT id FROM goals WHERE member_id=?)",
        )
        .bind(redacted, redacted, memberId),
      this.db
        .prepare(
          "UPDATE action_items SET title=?,expected_evidence=NULL WHERE member_id=?",
        )
        .bind(redacted, memberId),
      this.db
        .prepare(
          "UPDATE evidence SET description=?,reference_uri=NULL WHERE member_id=?",
        )
        .bind(redacted, memberId),
      this.db
        .prepare(
          "UPDATE goal_confirmations SET member_words=?,confirmation_checks_json='{}' WHERE goal_version_id IN (SELECT v.id FROM goal_versions v JOIN goals g ON g.id=v.goal_id WHERE g.member_id=?)",
        )
        .bind(redacted, memberId),
      this.db
        .prepare(
          "UPDATE goal_links SET relevance_note='' WHERE goal_version_id IN (SELECT v.id FROM goal_versions v JOIN goals g ON g.id=v.goal_id WHERE g.member_id=?)",
        )
        .bind(memberId),
      this.db
        .prepare(
          "UPDATE goal_policy_links SET relevance_note='' WHERE goal_version_id IN (SELECT v.id FROM goal_versions v JOIN goals g ON g.id=v.goal_id WHERE g.member_id=?)",
        )
        .bind(memberId),
      this.db
        .prepare(
          "UPDATE smart_audits SET reasons_json='[]',exception_reason=NULL,alternative_review_method=NULL WHERE goal_version_id IN (SELECT v.id FROM goal_versions v JOIN goals g ON g.id=v.goal_id WHERE g.member_id=?)",
        )
        .bind(memberId),
      this.db
        .prepare("UPDATE goal_indicators SET basis_note='' WHERE member_id=?")
        .bind(memberId),
      this.db
        .prepare(
          "UPDATE progress_entries SET note='',blocker='' WHERE member_id=?",
        )
        .bind(memberId),
      this.db
        .prepare(
          "UPDATE reflections SET outcome='',learning='',feeling='' WHERE member_id=?",
        )
        .bind(memberId),
      this.db
        .prepare(
          "UPDATE support_suggestions SET content=?,rationale=? WHERE member_id=?",
        )
        .bind(redacted, redacted, memberId),
      this.db
        .prepare(
          "UPDATE one_on_ones SET theme='',version=version+1,updated_at=? WHERE member_id=?",
        )
        .bind(finish, memberId),
      this.db
        .prepare(
          "UPDATE one_on_one_entries SET body=?,member_confirmation_words=CASE WHEN member_confirmation_words IS NULL THEN NULL ELSE ? END WHERE one_on_one_id IN (SELECT id FROM one_on_ones WHERE member_id=?)",
        )
        .bind(redacted, redacted, memberId),
      this.db
        .prepare(
          "UPDATE ai_requests SET sanitized_context_cipher_ref='',input_refs_json='[]',redaction_report_json='{}',version=version+1,updated_at=? WHERE member_id=?",
        )
        .bind(finish, memberId),
      this.db
        .prepare(
          "UPDATE ai_responses SET facts_used_json='[]',unknowns_json='[]',questions_json='[]',warnings_json='[]',confidence_note=? WHERE request_id IN (SELECT id FROM ai_requests WHERE member_id=?)",
        )
        .bind(redacted, memberId),
      this.db
        .prepare(
          "UPDATE ai_suggestions SET payload_json='{}',rationale=?,source_refs_json='[]',decision_reason=CASE WHEN decision_reason IS NULL THEN NULL ELSE ? END,version=version+1 WHERE request_id IN (SELECT id FROM ai_requests WHERE member_id=?)",
        )
        .bind(redacted, redacted, memberId),
      this.db
        .prepare(
          "UPDATE ai_adopted_drafts SET content=?,edit_diff_json='{}' WHERE member_id=?",
        )
        .bind(redacted, memberId),
      this.db
        .prepare(
          "UPDATE share_snapshots SET revoked_at=?,mutation_nonce=?,version=version+1 WHERE member_id=? AND revoked_at IS NULL",
        )
        .bind(finish, crypto.randomUUID(), memberId),
      this.db
        .prepare(
          "UPDATE share_tokens SET revoked_at=? WHERE snapshot_id IN (SELECT id FROM share_snapshots WHERE member_id=?) AND revoked_at IS NULL",
        )
        .bind(finish, memberId),
      this.db
        .prepare(
          "UPDATE share_confirmations SET member_words=? WHERE snapshot_id IN (SELECT id FROM share_snapshots WHERE member_id=?)",
        )
        .bind(redacted, memberId),
      this.db
        .prepare(
          `UPDATE review_comments SET body=? WHERE review_request_id IN (
            SELECT r.id FROM review_requests r WHERE
              (r.target_type='GOAL_VERSION' AND EXISTS(SELECT 1 FROM goal_versions v JOIN goals g ON g.id=v.goal_id WHERE v.id=r.target_id AND g.member_id=?)) OR
              (r.target_type='PROGRESS_ENTRY' AND EXISTS(SELECT 1 FROM progress_entries p WHERE p.id=r.target_id AND p.member_id=?)) OR
              (r.target_type='REFLECTION' AND EXISTS(SELECT 1 FROM reflections f WHERE f.id=r.target_id AND f.member_id=?)) OR
              (r.target_type='ONE_ON_ONE_ENTRY' AND EXISTS(SELECT 1 FROM one_on_one_entries e JOIN one_on_ones o ON o.id=e.one_on_one_id WHERE e.id=r.target_id AND o.member_id=?))
          )`,
        )
        .bind(redacted, memberId, memberId, memberId, memberId),
      this.db
        .prepare(
          "UPDATE retention_actions SET status='EXECUTED',result_json=?,updated_at=? WHERE id=? AND status='EXECUTING'",
        )
        .bind(
          JSON.stringify({
            anonymized: true,
            deletedR2Objects: objectKeys.length,
            retained: "statistics",
          }),
          finish,
          actionId,
        ),
      this.audit(
        "RETENTION_EXECUTED",
        principal,
        "retention_action",
        actionId,
        requestId,
        finish,
        { deletedR2Objects: objectKeys.length, backupExportId: backup.id },
      ),
    ]);
    return this.listRetention();
  }

  private async backupManifest(
    sourceTimestamp: string,
  ): Promise<BackupManifest> {
    const counts: Record<string, number> = {};
    for (const table of BACKUP_TABLES) {
      const row = await this.db
        .prepare(`SELECT COUNT(*) count FROM ${table}`)
        .first<{ count: number }>();
      counts[table] = row?.count ?? 0;
    }
    const keys = await this.db
      .prepare(
        "SELECT r2_object_key object_key FROM share_snapshots UNION SELECT sanitized_context_cipher_ref FROM ai_requests WHERE sanitized_context_cipher_ref<>''",
      )
      .all<{ object_key: string }>();
    return {
      format: "CAREER_COMPASS_BACKUP_MANIFEST_V1",
      schemaVersion: "0013",
      sourceTimestamp,
      counts,
      r2Keys: keys.results.map((row) => row.object_key).sort(),
    };
  }

  async createBackupExport(
    principal: Principal,
    input: z.infer<typeof backupExportInput>,
    requestId: string,
  ) {
    const existing = await this.db
      .prepare(
        "SELECT id FROM backup_exports WHERE created_by=? AND idempotency_key=?",
      )
      .bind(principal.actorId, input.idempotencyKey)
      .first<{ id: string }>();
    if (existing) return this.dashboard();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const sourceAge =
      new Date(now).getTime() - new Date(input.sourceTimestamp).getTime();
    if (sourceAge < -5 * 60_000 || sourceAge > 24 * 3_600_000)
      throw new MemberError(
        "VALIDATION_ERROR",
        422,
        "backup_source_timestamp_out_of_range",
      );
    const objectKey = `backups/${input.environment.toLowerCase()}/${now.slice(0, 10)}/${id}.json`;
    const manifest = await this.backupManifest(input.sourceTimestamp);
    const content = JSON.stringify(manifest);
    const checksum = await sha256(content);
    try {
      await this.db
        .prepare(
          "INSERT INTO backup_exports(id,environment,status,schema_version,object_key,source_timestamp,expires_at,created_by,idempotency_key,created_at) VALUES(?,?,'PENDING','0013',?,?,?,?,?,?)",
        )
        .bind(
          id,
          input.environment,
          objectKey,
          input.sourceTimestamp,
          isoPlusDays(now, 30),
          principal.actorId,
          input.idempotencyKey,
          now,
        )
        .run();
    } catch {
      const raced = await this.db
        .prepare(
          "SELECT id FROM backup_exports WHERE created_by=? AND idempotency_key=?",
        )
        .bind(principal.actorId, input.idempotencyKey)
        .first<{ id: string }>();
      if (raced) return this.dashboard();
      throw new MemberError("VERSION_CONFLICT", 409, "backup_create_conflict");
    }
    try {
      await this.files.put(objectKey, content, {
        httpMetadata: { contentType: "application/json" },
        customMetadata: { checksum, schemaVersion: "0013" },
      });
      await this.db.batch([
        this.db
          .prepare(
            "UPDATE backup_exports SET status='READY',manifest_checksum=? WHERE id=? AND status='PENDING'",
          )
          .bind(checksum, id),
        this.audit(
          "BACKUP_EXPORT_READY",
          principal,
          "backup_export",
          id,
          requestId,
          now,
          {
            checksum,
            retentionDays: 30,
          },
        ),
      ]);
    } catch {
      await this.db
        .prepare(
          "UPDATE backup_exports SET status='FAILED' WHERE id=? AND status='PENDING'",
        )
        .bind(id)
        .run();
      throw new MemberError(
        "DEPENDENCY_UNAVAILABLE",
        503,
        "backup_store_failed",
      );
    }
    return this.dashboard();
  }

  async recordRestoreExercise(
    principal: Principal,
    backupId: string,
    input: z.infer<typeof restoreExerciseInput>,
    requestId: string,
  ) {
    const backup = await this.db
      .prepare("SELECT * FROM backup_exports WHERE id=? AND status='READY'")
      .bind(backupId)
      .first<{
        id: string;
        environment: string;
        object_key: string;
        manifest_checksum: string;
        source_timestamp: string;
      }>();
    if (!backup)
      throw new MemberError("RESOURCE_NOT_FOUND", 404, "backup_not_ready");
    const object = await this.files.get(backup.object_key);
    if (!object)
      throw new MemberError(
        "DEPENDENCY_UNAVAILABLE",
        503,
        "backup_object_missing",
      );
    const content = await object.text();
    const checksumVerified =
      (await sha256(content)) === backup.manifest_checksum;
    let manifest: BackupManifest;
    try {
      manifest = JSON.parse(content) as typeof manifest;
    } catch {
      throw new MemberError("VALIDATION_ERROR", 422, "backup_manifest_invalid");
    }
    const current = await this.backupManifest(backup.source_timestamp);
    const schemaVerified =
      checksumVerified && manifest.schemaVersion === "0013";
    const countsVerified =
      JSON.stringify(manifest.counts) === JSON.stringify(current.counts);
    let r2RefsVerified = true;
    for (const key of manifest.r2Keys) {
      if (!(await this.files.get(key))) {
        r2RefsVerified = false;
        break;
      }
    }
    const rpoHours = Math.max(
      0,
      (new Date(input.startedAt).getTime() -
        new Date(backup.source_timestamp).getTime()) /
        3_600_000,
    );
    const rtoMinutes =
      (new Date(input.completedAt).getTime() -
        new Date(input.startedAt).getTime()) /
      60_000;
    const passed =
      schemaVerified &&
      countsVerified &&
      r2RefsVerified &&
      input.authorizationSmokeVerified &&
      rpoHours <= 24 &&
      rtoMinutes <= 1440;
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await this.db.batch([
      this.db
        .prepare(
          "INSERT INTO restore_exercises(id,backup_export_id,environment,status,started_at,completed_at,rpo_hours,rto_minutes,schema_verified,counts_verified,r2_refs_verified,authorization_smoke_verified,notes,executed_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        )
        .bind(
          id,
          backupId,
          input.environment,
          passed ? "PASSED" : "FAILED",
          input.startedAt,
          input.completedAt,
          rpoHours,
          rtoMinutes,
          schemaVerified ? 1 : 0,
          countsVerified ? 1 : 0,
          r2RefsVerified ? 1 : 0,
          input.authorizationSmokeVerified ? 1 : 0,
          input.notes,
          principal.actorId,
          now,
        ),
      this.audit(
        "RESTORE_EXERCISE_RECORDED",
        principal,
        "restore_exercise",
        id,
        requestId,
        now,
        {
          passed,
          rpoHours,
          rtoMinutes,
        },
      ),
    ]);
    return this.dashboard();
  }

  async recordQuota(
    principal: Principal,
    input: z.infer<typeof quotaInput>,
    requestId: string,
  ) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await this.db.batch([
      this.db
        .prepare(
          "INSERT INTO quota_snapshots(id,environment,workers_percent,d1_percent,r2_percent,source,recorded_by,recorded_at) VALUES(?,?,?,?,?,?,?,?)",
        )
        .bind(
          id,
          input.environment,
          input.workersPercent,
          input.d1Percent,
          input.r2Percent,
          input.source,
          principal.actorId,
          now,
        ),
      this.audit(
        "QUOTA_SNAPSHOT_RECORDED",
        principal,
        "quota_snapshot",
        id,
        requestId,
        now,
        {
          warning:
            Math.max(input.workersPercent, input.d1Percent, input.r2Percent) >=
            80,
        },
      ),
    ]);
    return this.dashboard();
  }
}
