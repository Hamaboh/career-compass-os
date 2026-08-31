import type { Principal } from "../auth/types";
import { MemberError } from "../member/errors";
import type { AiOperation, InputRef } from "./schemas";
import {
  deterministicFakeResponse,
  validateFakeResponse,
} from "./fake-provider";
import {
  inspectSanitized,
  sanitizeContext,
  sha256,
  type RedactionReport,
} from "./safety";

type PrivateFiles = Pick<R2Bucket, "get" | "put" | "delete">;
type RequestRow = {
  id: string;
  operation: AiOperation;
  actor_id: string;
  member_id: string;
  unit_id: string;
  purpose: string;
  status: string;
  context_hash: string;
  sanitized_context_cipher_ref: string;
  context_expires_at: string;
  input_refs_json: string;
  redaction_report_json: string;
  prompt_version_id: string;
  model_policy_id: string;
  schema_version: string;
  estimated_microunits: number;
  approved_by: string | null;
  approved_at: string | null;
  approval_hash: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  actual_microunits: number | null;
  error_code: string | null;
  idempotency_key: string;
  execution_fingerprint: string;
  executive_visible: number;
  version: number;
  created_at: string;
  updated_at: string;
};
type ModelRow = {
  id: string;
  model_alias: string;
  input_limit: number;
  output_limit: number;
  monthly_cap_microunits: number;
};
type ContextRecord = {
  ref: InputRef;
  label: string;
  text: string;
  executiveVisible: boolean;
};

const contextQueries: Record<InputRef["type"], string> = {
  GOAL_VERSION: `SELECT v.title||'\n'||v.description||'\n成功基準: '||v.success_criteria AS text,v.visibility
    FROM goal_versions v JOIN goals g ON g.id=v.goal_id
    WHERE v.id=? AND g.member_id=? AND g.unit_id=? AND g.current_version_id=v.id AND v.confidentiality='NORMAL' AND v.ai_send_policy='AI_SEND_ALLOWED'`,
  PROGRESS_ENTRY: `SELECT '状態: '||p.state||' 進捗率: '||coalesce(p.percent,'未回答')||'\n'||p.note||'\n障害: '||p.blocker AS text,'UL_AND_EXEC' AS visibility
    FROM progress_entries p JOIN goals g ON g.id=p.goal_id
    WHERE p.id=? AND p.member_id=? AND p.unit_id=? AND g.current_version_id=p.goal_version_id AND p.confidentiality='NORMAL' AND p.ai_send_policy='AI_SEND_ALLOWED'`,
  REFLECTION: `SELECT '結果: '||r.outcome||'\n学び: '||r.learning||'\n次の選択: '||r.next_choice AS text,'UL_AND_EXEC' AS visibility
    FROM reflections r JOIN goals g ON g.id=r.goal_id
    WHERE r.id=? AND r.member_id=? AND r.unit_id=? AND g.current_version_id=r.goal_version_id AND r.confidentiality='NORMAL' AND r.ai_send_policy='AI_SEND_ALLOWED'`,
  ACTION_ITEM: `SELECT '行動: '||a.title||' 状態: '||a.status||' 期限: '||coalesce(a.due_at,'未設定') AS text,'UL_AND_EXEC' AS visibility
    FROM action_items a JOIN goal_versions v ON v.id=a.goal_version_id JOIN goals g ON g.id=v.goal_id
    WHERE a.id=? AND a.member_id=? AND g.unit_id=? AND g.current_version_id=a.goal_version_id`,
  ONE_ON_ONE_ENTRY: `SELECT e.entry_type||': '||e.body AS text,'UL_AND_EXEC' AS visibility
    FROM one_on_one_entries e JOIN one_on_ones o ON o.id=e.one_on_one_id
    WHERE e.id=? AND o.member_id=? AND o.unit_id=? AND e.confidentiality='NORMAL' AND e.ai_send_policy='AI_SEND_ALLOWED'
      AND (e.goal_version_id IS NULL OR EXISTS(SELECT 1 FROM goals g WHERE g.member_id=o.member_id AND g.current_version_id=e.goal_version_id))`,
};

const labels: Record<InputRef["type"], string> = {
  GOAL_VERSION: "現行目標",
  PROGRESS_ENTRY: "進捗記録",
  REFLECTION: "振り返り",
  ACTION_ITEM: "行動",
  ONE_ON_ONE_ENTRY: "1on1記録",
};

export class AiSafetyRepository {
  constructor(
    private readonly db: D1Database,
    private readonly files: PrivateFiles,
  ) {}

  private async bestEffortDelete(key: string) {
    try {
      await this.files.delete(key);
    } catch {
      // D1 remains authoritative and expiry metadata keeps stale content unusable.
    }
  }

  private audit(
    eventType: string,
    principal: Principal,
    targetId: string,
    requestId: string,
    now: string,
    reason = "operation_succeeded",
  ) {
    return this.db
      .prepare(
        `INSERT INTO audit_events(id,event_type,occurred_at,actor_id,target_type,target_id,outcome,reason,request_id,metadata_json)
      VALUES(?,?,?,?,? ,?,'SUCCEEDED',?,?,?)`,
      )
      .bind(
        crypto.randomUUID(),
        eventType,
        now,
        principal.actorId,
        "ai_request",
        targetId,
        reason,
        requestId,
        "{}",
      );
  }

  private auditWhen(
    eventType: string,
    principal: Principal,
    targetId: string,
    requestId: string,
    now: string,
    predicate: string,
    predicateBindings: unknown[],
    reason = "operation_succeeded",
  ) {
    return this.db
      .prepare(
        `INSERT INTO audit_events(id,event_type,occurred_at,actor_id,target_type,target_id,outcome,reason,request_id,metadata_json)
         SELECT ?,?,?,?,?,?,'SUCCEEDED',?,?,? WHERE ${predicate}`,
      )
      .bind(
        crypto.randomUUID(),
        eventType,
        now,
        principal.actorId,
        "ai_request",
        targetId,
        reason,
        requestId,
        "{}",
        ...predicateBindings,
      );
  }

  private publicRequest(row: RequestRow) {
    return {
      id: row.id,
      operation: row.operation,
      memberId: row.member_id,
      purpose: row.purpose,
      status: row.status,
      contextHash: row.context_hash,
      redactionReport: JSON.parse(row.redaction_report_json),
      promptVersionId: row.prompt_version_id,
      modelPolicyId: row.model_policy_id,
      modelAlias: "POC_PENDING_FAKE",
      schemaVersion: row.schema_version,
      estimatedMicrounits: row.estimated_microunits,
      approvedBy: row.approved_by,
      approvedAt: row.approved_at,
      inputTokens: row.input_tokens,
      outputTokens: row.output_tokens,
      actualMicrounits: row.actual_microunits,
      errorCode: row.error_code,
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private async ownedRequest(
    principal: Principal,
    id: string,
    allowExecutiveRead = false,
  ) {
    const units = principal.unitScopes.map((scope) => scope.unitId);
    const row = await this.db
      .prepare(
        `SELECT * FROM ai_requests WHERE id=? AND
      ((actor_id=? AND unit_id IN (${units.map(() => "?").join(",") || "NULL"})) OR (?=1 AND executive_visible=1))`,
      )
      .bind(
        id,
        principal.actorId,
        ...units,
        allowExecutiveRead && principal.globalUnitRead ? 1 : 0,
      )
      .first<RequestRow>();
    if (!row)
      throw new MemberError(
        "RESOURCE_NOT_FOUND",
        404,
        "ai_request_not_visible",
      );
    return row;
  }

  async prepare(
    principal: Principal,
    input: {
      memberId: string;
      operation: AiOperation;
      purpose: string;
      inputRefs: InputRef[];
      idempotencyKey: string;
    },
    requestId: string,
  ) {
    const unit = await this.db
      .prepare(
        `SELECT h.unit_id,m.display_name,m.employee_ref,u.name AS unit_name,a.display_name AS actor_name,a.email_normalized AS actor_email
      FROM members m JOIN member_unit_history h ON h.member_id=m.id AND h.is_primary=1 AND h.ended_on IS NULL
      JOIN units u ON u.id=h.unit_id JOIN app_users a ON a.id=? WHERE m.id=? AND h.unit_id IN (${principal.unitScopes.map(() => "?").join(",") || "NULL"})`,
      )
      .bind(
        principal.actorId,
        input.memberId,
        ...principal.unitScopes.map((scope) => scope.unitId),
      )
      .first<{
        unit_id: string;
        display_name: string;
        employee_ref: string;
        unit_name: string;
        actor_name: string;
        actor_email: string;
      }>();
    if (!unit)
      throw new MemberError("RESOURCE_NOT_FOUND", 404, "member_not_visible");

    const records: ContextRecord[] = [];
    const excluded: RedactionReport["excludedRefs"] = [];
    for (const ref of input.inputRefs) {
      const row = await this.db
        .prepare(contextQueries[ref.type])
        .bind(ref.id, input.memberId, unit.unit_id)
        .first<{ text: string; visibility: string }>();
      if (!row) excluded.push({ ...ref, reason: "NOT_ALLOWED_OR_NOT_FOUND" });
      else
        records.push({
          ref,
          label: labels[ref.type],
          text: row.text,
          executiveVisible: row.visibility === "UL_AND_EXEC",
        });
    }
    if (!records.length) {
      await this.db.batch([
        this.audit(
          "AI_BOUNDARY_VIOLATION",
          principal,
          input.memberId,
          requestId,
          new Date().toISOString(),
          "no_sendable_context",
        ),
      ]);
      throw new MemberError("AI_CONTEXT_EMPTY", 422, "no_sendable_context");
    }
    const { sanitizedText, report } = sanitizeContext(
      records,
      {
        memberName: unit.display_name,
        employeeRef: unit.employee_ref,
        unitName: unit.unit_name,
        actorName: unit.actor_name,
        actorEmail: unit.actor_email,
      },
      excluded,
    );
    const policy = await this.db
      .prepare(
        `SELECT mp.* FROM model_policies mp WHERE mp.operation=? AND mp.enabled=1 AND mp.provider='DETERMINISTIC_FAKE'`,
      )
      .bind(input.operation)
      .first<ModelRow>();
    const prompt = await this.db
      .prepare(
        "SELECT id,schema_version,template_checksum FROM prompt_versions WHERE operation=? AND status='ACTIVE'",
      )
      .bind(input.operation)
      .first<{
        id: string;
        schema_version: string;
        template_checksum: string;
      }>();
    if (!policy || !prompt)
      throw new MemberError("AI_UNAVAILABLE", 503, "fake_policy_unavailable");
    const estimatedTokens = Math.ceil(sanitizedText.length / 4);
    if (estimatedTokens > policy.input_limit)
      throw new MemberError(
        "AI_CONTEXT_TOO_LARGE",
        422,
        "context_limit_exceeded",
      );
    const contextHash = await sha256(sanitizedText);
    const fingerprint = await sha256(
      JSON.stringify([
        input.operation,
        contextHash,
        prompt.template_checksum,
        prompt.schema_version,
        policy.id,
      ]),
    );
    const existing = await this.db
      .prepare(
        "SELECT * FROM ai_requests WHERE actor_id=? AND (idempotency_key=? OR execution_fingerprint=?) ORDER BY created_at DESC LIMIT 1",
      )
      .bind(principal.actorId, input.idempotencyKey, fingerprint)
      .first<RequestRow>();
    if (existing) {
      if (existing.execution_fingerprint !== fingerprint)
        throw new MemberError(
          "IDEMPOTENCY_CONFLICT",
          409,
          "idempotency_payload_changed",
        );
      return this.get(principal, existing.id);
    }

    const id = crypto.randomUUID(),
      now = new Date().toISOString(),
      objectKey = `ai-context/${id}.txt`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const estimate = Math.max(1, estimatedTokens * 100);
    const budget = await this.db
      .prepare(
        `SELECT coalesce(sum(CASE WHEN status='SETTLED' THEN actual_microunits ELSE estimated_microunits END),0) AS used
         FROM ai_budget_ledger WHERE month=? AND status IN ('RESERVED','SETTLED')`,
      )
      .bind(now.slice(0, 7))
      .first<{ used: number }>();
    if ((budget?.used ?? 0) + estimate >= policy.monthly_cap_microunits * 0.8)
      report.warnings.push("MONTHLY_BUDGET_AT_OR_ABOVE_80_PERCENT");
    await this.files.put(objectKey, sanitizedText, {
      customMetadata: { expiresAt, contextHash },
    });
    try {
      await this.db.batch([
        this.db
          .prepare(
            `INSERT INTO ai_requests(id,operation,actor_id,member_id,unit_id,purpose,status,context_hash,sanitized_context_cipher_ref,context_expires_at,input_refs_json,redaction_report_json,prompt_version_id,model_policy_id,schema_version,estimated_microunits,idempotency_key,execution_fingerprint,executive_visible,created_at,updated_at)
          VALUES(?,?,?,?,?,?,'AWAITING_UL_APPROVAL',?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          )
          .bind(
            id,
            input.operation,
            principal.actorId,
            input.memberId,
            unit.unit_id,
            input.purpose,
            contextHash,
            objectKey,
            expiresAt,
            JSON.stringify(input.inputRefs),
            JSON.stringify(report),
            prompt.id,
            policy.id,
            prompt.schema_version,
            estimate,
            input.idempotencyKey,
            fingerprint,
            records.every((record) => record.executiveVisible) ? 1 : 0,
            now,
            now,
          ),
        this.audit("AI_REQUEST_PREPARED", principal, id, requestId, now),
      ]);
    } catch (error) {
      await this.bestEffortDelete(objectKey);
      throw error;
    }
    return this.get(principal, id);
  }

  async preview(principal: Principal, id: string) {
    const row = await this.ownedRequest(principal, id);
    if (new Date(row.context_expires_at) <= new Date()) {
      await this.bestEffortDelete(row.sanitized_context_cipher_ref);
      throw new MemberError("AI_CONTEXT_EXPIRED", 409, "context_expired");
    }
    const object = await this.files.get(row.sanitized_context_cipher_ref);
    if (!object)
      throw new MemberError("AI_CONTEXT_EXPIRED", 409, "context_missing");
    const sanitizedText = await object.text();
    if ((await sha256(sanitizedText)) !== row.context_hash)
      throw new MemberError(
        "AI_BOUNDARY_VIOLATION",
        409,
        "context_hash_mismatch",
      );
    return {
      ...this.publicRequest(row),
      sanitizedText,
      canApprove:
        row.status === "AWAITING_UL_APPROVAL" &&
        inspectSanitized(sanitizedText).length === 0,
    };
  }

  async editPreview(
    principal: Principal,
    id: string,
    version: number,
    sanitizedText: string,
    requestId: string,
  ) {
    const row = await this.ownedRequest(principal, id);
    if (row.status !== "AWAITING_UL_APPROVAL" || row.version !== version)
      throw new MemberError(
        "VERSION_CONFLICT",
        409,
        "preview_version_conflict",
      );
    const violations = inspectSanitized(sanitizedText);
    if (violations.length) {
      await this.db.batch([
        this.audit(
          "AI_BOUNDARY_VIOLATION",
          principal,
          id,
          requestId,
          new Date().toISOString(),
          violations.join(","),
        ),
      ]);
      throw new MemberError(
        "AI_BOUNDARY_VIOLATION",
        422,
        "preview_leak_detected",
      );
    }
    const hash = await sha256(sanitizedText),
      now = new Date().toISOString(),
      nextObjectKey = `ai-context/${id}-${version + 1}.txt`;
    await this.files.put(nextObjectKey, sanitizedText, {
      customMetadata: { expiresAt: row.context_expires_at, contextHash: hash },
    });
    let results: D1Result[];
    try {
      results = await this.db.batch([
        this.db
          .prepare(
            `UPDATE ai_requests SET context_hash=?,sanitized_context_cipher_ref=?,approved_by=NULL,approved_at=NULL,approval_hash=NULL,version=version+1,updated_at=?
        WHERE id=? AND actor_id=? AND version=? AND status='AWAITING_UL_APPROVAL'`,
          )
          .bind(hash, nextObjectKey, now, id, principal.actorId, version),
        this.auditWhen(
          "AI_REQUEST_PREPARED",
          principal,
          id,
          requestId,
          now,
          "EXISTS(SELECT 1 FROM ai_requests WHERE id=? AND actor_id=? AND version=? AND updated_at=?)",
          [id, principal.actorId, version + 1, now],
          "preview_edited_reapproval_required",
        ),
      ]);
    } catch (error) {
      await this.bestEffortDelete(nextObjectKey);
      throw error;
    }
    if ((results[0]!.meta.changes ?? 0) !== 1) {
      await this.bestEffortDelete(nextObjectKey);
      throw new MemberError(
        "VERSION_CONFLICT",
        409,
        "preview_version_conflict",
      );
    }
    await this.bestEffortDelete(row.sanitized_context_cipher_ref);
    return this.preview(principal, id);
  }

  async reject(
    principal: Principal,
    id: string,
    version: number,
    requestId: string,
  ) {
    const now = new Date().toISOString();
    const results = await this.db.batch([
      this.db
        .prepare(
          "UPDATE ai_requests SET status='REJECTED',version=version+1,updated_at=? WHERE id=? AND actor_id=? AND version=? AND status='AWAITING_UL_APPROVAL'",
        )
        .bind(now, id, principal.actorId, version),
      this.auditWhen(
        "AI_REQUEST_REJECTED",
        principal,
        id,
        requestId,
        now,
        "EXISTS(SELECT 1 FROM ai_requests WHERE id=? AND actor_id=? AND status='REJECTED' AND updated_at=?)",
        [id, principal.actorId, now],
      ),
    ]);
    if ((results[0]!.meta.changes ?? 0) !== 1)
      throw new MemberError("VERSION_CONFLICT", 409, "request_state_conflict");
    await this.bestEffortDelete(
      (await this.ownedRequest(principal, id)).sanitized_context_cipher_ref,
    );
    return this.get(principal, id);
  }

  async approveAndRun(
    principal: Principal,
    id: string,
    version: number,
    requestId: string,
  ) {
    const row = await this.ownedRequest(principal, id);
    if (row.status !== "AWAITING_UL_APPROVAL" || row.version !== version)
      throw new MemberError("VERSION_CONFLICT", 409, "request_state_conflict");
    const object = await this.files.get(row.sanitized_context_cipher_ref);
    if (!object || new Date(row.context_expires_at) <= new Date()) {
      if (new Date(row.context_expires_at) <= new Date())
        await this.bestEffortDelete(row.sanitized_context_cipher_ref);
      throw new MemberError("AI_CONTEXT_EXPIRED", 409, "context_expired");
    }
    const text = await object.text(),
      hash = await sha256(text);
    if (hash !== row.context_hash || inspectSanitized(text).length) {
      await this.db.batch([
        this.audit(
          "AI_BOUNDARY_VIOLATION",
          principal,
          id,
          requestId,
          new Date().toISOString(),
          "approval_context_invalid",
        ),
      ]);
      throw new MemberError(
        "AI_BOUNDARY_VIOLATION",
        422,
        "approval_context_invalid",
      );
    }
    const policy = await this.db
      .prepare(
        "SELECT * FROM model_policies WHERE id=? AND enabled=1 AND provider='DETERMINISTIC_FAKE'",
      )
      .bind(row.model_policy_id)
      .first<ModelRow>();
    if (!policy)
      throw new MemberError("AI_UNAVAILABLE", 503, "fake_policy_unavailable");
    const month = new Date().toISOString().slice(0, 7);
    const usage = await this.db
      .prepare(
        `SELECT coalesce(sum(CASE WHEN status='SETTLED' THEN actual_microunits ELSE estimated_microunits END),0) AS used FROM ai_budget_ledger WHERE month=? AND status IN ('RESERVED','SETTLED')`,
      )
      .bind(month)
      .first<{ used: number }>();
    const now = new Date().toISOString(),
      approvalHash = await sha256(
        `${row.context_hash}:${row.model_policy_id}:${row.purpose}`,
      );
    if (
      (usage?.used ?? 0) + row.estimated_microunits >
      policy.monthly_cap_microunits
    ) {
      const blocked = await this.db.batch([
        this.db
          .prepare(
            "UPDATE ai_requests SET status='BLOCKED_BUDGET',error_code='AI_BUDGET_CAP',version=version+1,updated_at=? WHERE id=? AND actor_id=? AND version=? AND status='AWAITING_UL_APPROVAL'",
          )
          .bind(now, id, principal.actorId, version),
        this.auditWhen(
          "AI_BUDGET_BLOCKED",
          principal,
          id,
          requestId,
          now,
          "EXISTS(SELECT 1 FROM ai_requests WHERE id=? AND actor_id=? AND status='BLOCKED_BUDGET' AND updated_at=?)",
          [id, principal.actorId, now],
        ),
      ]);
      if ((blocked[0]!.meta.changes ?? 0) !== 1)
        throw new MemberError(
          "VERSION_CONFLICT",
          409,
          "request_state_conflict",
        );
      return this.get(principal, id);
    }
    const reservation = await this.db.batch([
      this.db
        .prepare(
          `UPDATE ai_requests SET status='APPROVED',approved_by=?,approved_at=?,approval_hash=?,version=version+1,updated_at=?
        WHERE id=? AND actor_id=? AND version=? AND status='AWAITING_UL_APPROVAL'`,
        )
        .bind(
          principal.actorId,
          now,
          approvalHash,
          now,
          id,
          principal.actorId,
          version,
        ),
      this.db
        .prepare(
          `INSERT INTO ai_budget_ledger(id,month,request_id,unit_id,actor_id,operation,estimated_microunits,status,created_at,updated_at)
        SELECT ?,?,?,?,?,?,?,'RESERVED',?,? FROM ai_requests WHERE id=? AND status='APPROVED' AND approved_at=?`,
        )
        .bind(
          crypto.randomUUID(),
          month,
          id,
          row.unit_id,
          principal.actorId,
          row.operation,
          row.estimated_microunits,
          now,
          now,
          id,
          now,
        ),
      this.auditWhen(
        "AI_REQUEST_APPROVED",
        principal,
        id,
        requestId,
        now,
        "EXISTS(SELECT 1 FROM ai_requests WHERE id=? AND actor_id=? AND status='APPROVED' AND approved_at=?)",
        [id, principal.actorId, now],
      ),
    ]);
    if ((reservation[0]!.meta.changes ?? 0) !== 1)
      throw new MemberError("VERSION_CONFLICT", 409, "request_state_conflict");

    const refs = JSON.parse(row.input_refs_json) as InputRef[];
    try {
      const validated = validateFakeResponse(
        deterministicFakeResponse(row.operation, refs, text),
        refs,
      );
      const sentAt = new Date().toISOString();
      const statements: D1PreparedStatement[] = [
        this.db
          .prepare(
            "UPDATE ai_requests SET status='SENT',version=version+1,updated_at=? WHERE id=? AND status='APPROVED' AND approval_hash=?",
          )
          .bind(sentAt, id, approvalHash),
        this.audit("AI_REQUEST_SENT", principal, id, requestId, sentAt),
        this.db
          .prepare(
            "INSERT INTO ai_responses VALUES(?,'VALIDATED',?,?,?,?,?,?,?)",
          )
          .bind(
            id,
            JSON.stringify(validated.factsUsed),
            JSON.stringify(validated.unknowns),
            JSON.stringify(validated.questions),
            JSON.stringify(validated.warnings),
            validated.confidenceNote,
            validated.schemaVersion,
            sentAt,
          ),
        ...validated.suggestions.map((suggestion) =>
          this.db
            .prepare(
              "INSERT INTO ai_suggestions(id,request_id,suggestion_type,payload_json,rationale,status,source_refs_json,version,created_at) VALUES(?,?,?,?,?,'PENDING',?,1,?)",
            )
            .bind(
              crypto.randomUUID(),
              id,
              suggestion.type,
              JSON.stringify({ content: suggestion.content }),
              suggestion.rationale,
              JSON.stringify(suggestion.sourceRefs),
              sentAt,
            ),
        ),
        this.db
          .prepare(
            "UPDATE ai_requests SET status='SUCCEEDED',input_tokens=?,output_tokens=?,actual_microunits=?,version=version+1,updated_at=? WHERE id=? AND status='SENT'",
          )
          .bind(
            validated.usage.inputTokens,
            validated.usage.outputTokens,
            validated.usage.costMicrounits,
            sentAt,
            id,
          ),
        this.db
          .prepare(
            "UPDATE ai_budget_ledger SET status='SETTLED',actual_microunits=?,updated_at=? WHERE request_id=? AND status='RESERVED'",
          )
          .bind(validated.usage.costMicrounits, sentAt, id),
        this.audit("AI_RESPONSE_ACCEPTED", principal, id, requestId, sentAt),
      ];
      await this.db.batch(statements);
      await this.bestEffortDelete(row.sanitized_context_cipher_ref);
    } catch {
      const failedAt = new Date().toISOString();
      await this.db.batch([
        this.db
          .prepare(
            "UPDATE ai_requests SET status='FAILED',error_code='AI_OUTPUT_INVALID',version=version+1,updated_at=? WHERE id=? AND status IN ('APPROVED','SENT')",
          )
          .bind(failedAt, id),
        this.db
          .prepare(
            "UPDATE ai_budget_ledger SET status='RELEASED',updated_at=? WHERE request_id=? AND status='RESERVED'",
          )
          .bind(failedAt, id),
        this.audit("AI_RESPONSE_REJECTED", principal, id, requestId, failedAt),
      ]);
    }
    return this.get(principal, id);
  }

  async get(principal: Principal, id: string) {
    const row = await this.ownedRequest(principal, id, true);
    const response = await this.db
      .prepare("SELECT * FROM ai_responses WHERE request_id=?")
      .bind(id)
      .first<Record<string, unknown>>();
    const suggestions = await this.db
      .prepare(
        "SELECT id,suggestion_type,payload_json,rationale,status,source_refs_json,decision_by,decision_at,decision_reason,version,created_at FROM ai_suggestions WHERE request_id=? ORDER BY created_at,id",
      )
      .bind(id)
      .all<Record<string, unknown>>();
    return {
      ...this.publicRequest(row),
      response,
      suggestions: suggestions.results,
    };
  }

  async decide(
    principal: Principal,
    suggestionId: string,
    input: {
      version: number;
      decision: "ACCEPTED" | "PARTIALLY_ACCEPTED" | "REJECTED";
      editedContent?: string;
      reason: string;
    },
    requestId: string,
  ) {
    const suggestion = await this.db
      .prepare(
        `SELECT s.*,r.member_id,r.unit_id,r.actor_id FROM ai_suggestions s JOIN ai_requests r ON r.id=s.request_id
      WHERE s.id=? AND r.actor_id=? AND r.unit_id IN (${principal.unitScopes.map(() => "?").join(",") || "NULL"})`,
      )
      .bind(
        suggestionId,
        principal.actorId,
        ...principal.unitScopes.map((scope) => scope.unitId),
      )
      .first<{
        id: string;
        payload_json: string;
        status: string;
        version: number;
        member_id: string;
        unit_id: string;
        actor_id: string;
      }>();
    if (!suggestion)
      throw new MemberError(
        "RESOURCE_NOT_FOUND",
        404,
        "suggestion_not_visible",
      );
    if (suggestion.status !== "PENDING" || suggestion.version !== input.version)
      throw new MemberError(
        "VERSION_CONFLICT",
        409,
        "suggestion_state_conflict",
      );
    const original = (
      JSON.parse(suggestion.payload_json) as { content: string }
    ).content;
    const content = input.editedContent ?? original;
    const now = new Date().toISOString(),
      adoptedId = crypto.randomUUID();
    const statements: D1PreparedStatement[] = [
      this.db
        .prepare(
          "UPDATE ai_suggestions SET status=?,decision_by=?,decision_at=?,decision_reason=?,version=version+1 WHERE id=? AND version=? AND status='PENDING'",
        )
        .bind(
          input.decision,
          principal.actorId,
          now,
          input.reason,
          suggestionId,
          input.version,
        ),
    ];
    if (input.decision !== "REJECTED")
      statements.push(
        this.db
          .prepare(
            `INSERT INTO ai_adopted_drafts(id,suggestion_id,member_id,unit_id,owner_actor_id,content,provenance_type,confirmation_status,edit_diff_json,created_at)
             SELECT ?,s.id,?,?,?,?,'UL_OBSERVATION','HUMAN_DRAFT',?,? FROM ai_suggestions s
             WHERE s.id=? AND s.status=? AND s.decision_at=?`,
          )
          .bind(
            adoptedId,
            suggestion.member_id,
            suggestion.unit_id,
            principal.actorId,
            content,
            JSON.stringify({
              original,
              edited: content,
              changed: original !== content,
            }),
            now,
            suggestionId,
            input.decision,
            now,
          ),
      );
    statements.push(
      this.auditWhen(
        input.decision === "PARTIALLY_ACCEPTED"
          ? "AI_SUGGESTION_PARTIALLY_APPLIED"
          : input.decision === "ACCEPTED"
            ? "AI_SUGGESTION_APPLIED"
            : "AI_SUGGESTION_REJECTED",
        principal,
        suggestionId,
        requestId,
        now,
        "EXISTS(SELECT 1 FROM ai_suggestions WHERE id=? AND status=? AND decision_at=?)",
        [suggestionId, input.decision, now],
      ),
    );
    const results = await this.db.batch(statements);
    if ((results[0]!.meta.changes ?? 0) !== 1)
      throw new MemberError(
        "VERSION_CONFLICT",
        409,
        "suggestion_state_conflict",
      );
    return {
      suggestionId,
      decision: input.decision,
      adoptedDraftId: input.decision === "REJECTED" ? null : adoptedId,
      confirmationStatus: input.decision === "REJECTED" ? null : "HUMAN_DRAFT",
    };
  }
}
