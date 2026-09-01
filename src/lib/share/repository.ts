import type { Principal } from "../auth/types";
import { MemberError } from "../member/errors";
import { renderShareHtml } from "./html";

type Files = Pick<R2Bucket, "get" | "put" | "delete">;
type Snapshot = {
  id: string;
  member_id: string;
  unit_id: string;
  r2_object_key: string;
  content_checksum: string;
  source_refs_json: string;
  exclusion_summary_json: string;
  created_by: string;
  expires_at: string;
  revoked_at: string | null;
  mutation_nonce: string | null;
  version: number;
  created_at: string;
};

async function digest(value: string) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function rawToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

export class ShareRepository {
  constructor(
    private readonly db: D1Database,
    private readonly files: Files,
  ) {}

  private audit(
    type: string,
    actorId: string | null,
    targetType: string,
    targetId: string,
    requestId: string,
    now: string,
    reason = "operation_succeeded",
  ) {
    return this.db
      .prepare(
        "INSERT INTO audit_events(id,event_type,occurred_at,actor_id,target_type,target_id,outcome,reason,request_id,metadata_json) VALUES(?,?,?,?,?,?,'SUCCEEDED',?,?, '{}')",
      )
      .bind(
        crypto.randomUUID(),
        type,
        now,
        actorId,
        targetType,
        targetId,
        reason,
        requestId,
      );
  }

  private auditWhen(
    type: string,
    actorId: string | null,
    targetType: string,
    targetId: string,
    requestId: string,
    now: string,
    predicate: string,
    bindings: unknown[],
  ) {
    return this.db
      .prepare(
        `INSERT INTO audit_events(id,event_type,occurred_at,actor_id,target_type,target_id,outcome,reason,request_id,metadata_json)
         SELECT ?,?,?,?,?,?,'SUCCEEDED','operation_succeeded',?,'{}' WHERE ${predicate}`,
      )
      .bind(
        crypto.randomUUID(),
        type,
        now,
        actorId,
        targetType,
        targetId,
        requestId,
        ...bindings,
      );
  }

  private units(principal: Principal) {
    return principal.unitScopes.map((scope) => scope.unitId);
  }

  private async member(principal: Principal, memberId: string, write: boolean) {
    if (
      !write &&
      !principal.roles.includes("UL") &&
      !principal.roles.includes("EXECUTIVE")
    )
      throw new MemberError(
        "RESOURCE_NOT_FOUND",
        404,
        "share_read_not_available",
      );
    if (
      write &&
      (!principal.roles.includes("UL") ||
        principal.globalUnitRead ||
        !principal.capabilities.includes("UNIT_EDIT_SCOPED"))
    )
      throw new MemberError(
        "RESOURCE_NOT_FOUND",
        404,
        "share_mutation_not_available",
      );
    const units = this.units(principal);
    const row = await this.db
      .prepare(
        `SELECT m.id,m.display_name,h.unit_id FROM members m JOIN member_unit_history h ON h.member_id=m.id AND h.is_primary=1 AND h.ended_on IS NULL
      WHERE m.id=? AND (${principal.globalUnitRead && !write ? "1=1" : `h.unit_id IN (${units.map(() => "?").join(",") || "NULL"})`})`,
      )
      .bind(memberId, ...(principal.globalUnitRead && !write ? [] : units))
      .first<{ id: string; display_name: string; unit_id: string }>();
    if (!row)
      throw new MemberError("RESOURCE_NOT_FOUND", 404, "member_not_visible");
    return row;
  }

  private async snapshot(principal: Principal, id: string, write: boolean) {
    const units = this.units(principal);
    if (
      !write &&
      !principal.roles.includes("UL") &&
      !principal.roles.includes("EXECUTIVE")
    )
      throw new MemberError(
        "RESOURCE_NOT_FOUND",
        404,
        "share_read_not_available",
      );
    if (
      write &&
      (!principal.roles.includes("UL") ||
        principal.globalUnitRead ||
        !principal.capabilities.includes("UNIT_EDIT_SCOPED"))
    )
      throw new MemberError(
        "RESOURCE_NOT_FOUND",
        404,
        "share_mutation_not_available",
      );
    const row = await this.db
      .prepare(
        `SELECT * FROM share_snapshots WHERE id=? AND (${principal.globalUnitRead && !write ? "1=1" : `unit_id IN (${units.map(() => "?").join(",") || "NULL"})`})`,
      )
      .bind(id, ...(principal.globalUnitRead && !write ? [] : units))
      .first<Snapshot>();
    if (!row)
      throw new MemberError("RESOURCE_NOT_FOUND", 404, "snapshot_not_visible");
    return row;
  }

  private async cleanup(key: string) {
    try {
      await this.files.delete(key);
    } catch {}
  }

  private async enforcePublicRateLimit(clientId: string, now: string) {
    const windowStartedAt = new Date(
      Math.floor(new Date(now).getTime() / 300000) * 300000,
    ).toISOString();
    const clientHash = await digest(`public-share:${clientId}`);
    await this.db
      .prepare(
        "INSERT INTO share_access_windows(client_hash,window_started_at,attempt_count,last_attempt_at) VALUES(?,?,1,?) ON CONFLICT(client_hash,window_started_at) DO UPDATE SET attempt_count=attempt_count+1,last_attempt_at=excluded.last_attempt_at",
      )
      .bind(clientHash, windowStartedAt, now)
      .run();
    const window = await this.db
      .prepare(
        "SELECT attempt_count FROM share_access_windows WHERE client_hash=? AND window_started_at=?",
      )
      .bind(clientHash, windowStartedAt)
      .first<{ attempt_count: number }>();
    if ((window?.attempt_count ?? 1) > 60)
      throw new MemberError("RATE_LIMITED", 429, "public_share_rate_limited");
  }

  async create(
    principal: Principal,
    memberId: string,
    idempotencyKey: string,
    requestId: string,
  ) {
    const member = await this.member(principal, memberId, true);
    const existing = await this.db
      .prepare(
        "SELECT id FROM share_snapshots WHERE created_by=? AND idempotency_key=?",
      )
      .bind(principal.actorId, idempotencyKey)
      .first<{ id: string }>();
    if (existing) return this.preview(principal, existing.id);

    const futures = await this.db
      .prepare(
        `SELECT id,kind,statement,version FROM future_vision_versions f WHERE member_id=? AND unit_id=? AND status='MEMBER_CONFIRMED' AND provenance_type='MEMBER_CONFIRMED' AND confidentiality='NORMAL'
      AND NOT EXISTS(SELECT 1 FROM future_vision_versions n WHERE n.member_id=f.member_id AND n.kind=f.kind AND n.version>f.version AND n.status='MEMBER_CONFIRMED') ORDER BY kind`,
      )
      .bind(memberId, member.unit_id)
      .all<{ id: string; kind: string; statement: string; version: number }>();
    const entries = await this.db
      .prepare(
        `SELECT e.id,q.domain,q.prompt_text,e.response_text FROM self_analysis_entries e JOIN self_analysis_sessions s ON s.id=e.session_id LEFT JOIN self_analysis_questions q ON q.id=e.question_id
      WHERE s.member_id=? AND s.unit_id=? AND e.response_status='ANSWERED' AND e.provenance_type='MEMBER_CONFIRMED' AND e.confidentiality='NORMAL' ORDER BY e.created_at`,
      )
      .bind(memberId, member.unit_id)
      .all<{
        id: string;
        domain: string | null;
        prompt_text: string | null;
        response_text: string;
      }>();
    const goals = await this.db
      .prepare(
        `SELECT g.id,g.current_version_id,g.lifecycle_status,v.version_no,v.title,v.description,v.target_date,v.success_criteria FROM goals g JOIN goal_versions v ON v.id=g.current_version_id JOIN goal_confirmations c ON c.goal_version_id=v.id AND c.result='APPROVED'
      WHERE g.member_id=? AND g.unit_id=? AND g.lifecycle_status IN ('CONFIRMED','ACTIVE','PAUSED') AND v.status='CONFIRMED' AND v.provenance_type='MEMBER_CONFIRMED' AND v.confidentiality='NORMAL' ORDER BY g.created_at`,
      )
      .bind(memberId, member.unit_id)
      .all<{
        id: string;
        current_version_id: string;
        lifecycle_status: string;
        version_no: number;
        title: string;
        description: string;
        target_date: string | null;
        success_criteria: string;
      }>();

    const sourceRefs: Array<{ type: string; id: string }> = [];
    const versionLabels: string[] = [];
    const goalItems: Array<{ heading: string; lines: string[] }> = [];
    const actionItems: Array<{ heading: string; lines: string[] }> = [];
    const reflectionItems: Array<{ heading: string; lines: string[] }> = [];
    for (const goal of goals.results) {
      sourceRefs.push({ type: "GOAL_VERSION", id: goal.current_version_id });
      versionLabels.push(`${goal.title} v${goal.version_no}`);
      const smart = await this.db
        .prepare(
          "SELECT specific_status,measurable_status,achievable_status,relevant_status,time_bound_status,exception_reason,alternative_review_method,exception_review_date FROM smart_audits WHERE goal_version_id=?",
        )
        .bind(goal.current_version_id)
        .first<Record<string, string | null>>();
      goalItems.push({
        heading: goal.title,
        lines: [
          goal.description,
          `期限: ${goal.target_date ?? "未設定"}`,
          `達成基準: ${goal.success_criteria}`,
          smart
            ? `SMART: S=${smart.specific_status} M=${smart.measurable_status} A=${smart.achievable_status} R=${smart.relevant_status} T=${smart.time_bound_status}`
            : "SMART: 記録なし",
          ...(smart?.exception_reason
            ? [
                `例外理由: ${smart.exception_reason}`,
                `代替確認: ${smart.alternative_review_method ?? ""} / ${smart.exception_review_date ?? ""}`,
              ]
            : []),
        ],
      });
      const actions = await this.db
        .prepare(
          "SELECT id,title,due_at,status,expected_evidence FROM action_items WHERE goal_version_id=? AND member_id=? AND provenance_type='MEMBER_CONFIRMED' ORDER BY sort_order,created_at",
        )
        .bind(goal.current_version_id, memberId)
        .all<{
          id: string;
          title: string;
          due_at: string | null;
          status: string;
          expected_evidence: string | null;
        }>();
      for (const action of actions.results) {
        sourceRefs.push({ type: "ACTION_ITEM", id: action.id });
        actionItems.push({
          heading: action.title,
          lines: [
            `状態: ${action.status}`,
            `期限: ${action.due_at ?? "未設定"}`,
            `証拠候補: ${action.expected_evidence ?? "未設定"}`,
          ],
        });
      }
      const evidence = await this.db
        .prepare(
          "SELECT id,description,occurred_on,verification_status FROM evidence WHERE goal_version_id=? AND member_id=? AND verification_status IN ('MEMBER_CONFIRMED','UL_VERIFIED') ORDER BY created_at",
        )
        .bind(goal.current_version_id, memberId)
        .all<{
          id: string;
          description: string;
          occurred_on: string | null;
          verification_status: string;
        }>();
      for (const item of evidence.results) {
        sourceRefs.push({ type: "EVIDENCE", id: item.id });
        actionItems.push({
          heading: "成果・証拠",
          lines: [
            item.description,
            `日付: ${item.occurred_on ?? "未設定"}`,
            `確認: ${item.verification_status}`,
          ],
        });
      }
      const progress = await this.db
        .prepare(
          "SELECT id,state,percent,self_rating,note,recorded_at FROM progress_entries WHERE goal_version_id=? AND member_id=? AND provenance_type='MEMBER_CONFIRMED' AND confidentiality='NORMAL' ORDER BY recorded_at",
        )
        .bind(goal.current_version_id, memberId)
        .all<{
          id: string;
          state: string;
          percent: number | null;
          self_rating: number | null;
          note: string;
          recorded_at: string;
        }>();
      for (const item of progress.results) {
        sourceRefs.push({ type: "PROGRESS_ENTRY", id: item.id });
        reflectionItems.push({
          heading: `進捗 ${item.recorded_at}`,
          lines: [
            `状態: ${item.state}`,
            `進捗率: ${item.percent ?? "未回答"}`,
            `本人自己評価: ${item.self_rating ?? "未回答"}`,
            item.note,
          ],
        });
      }
      const reflections = await this.db
        .prepare(
          "SELECT id,period_start,period_end,outcome,learning,feeling,next_choice FROM reflections WHERE goal_version_id=? AND member_id=? AND provenance_type='MEMBER_CONFIRMED' AND confidentiality='NORMAL' ORDER BY period_end",
        )
        .bind(goal.current_version_id, memberId)
        .all<{
          id: string;
          period_start: string;
          period_end: string;
          outcome: string;
          learning: string;
          feeling: string;
          next_choice: string;
        }>();
      for (const item of reflections.results) {
        sourceRefs.push({ type: "REFLECTION", id: item.id });
        reflectionItems.push({
          heading: `振り返り ${item.period_start}〜${item.period_end}`,
          lines: [
            `結果: ${item.outcome}`,
            `学び: ${item.learning}`,
            `気持ち: ${item.feeling}`,
            `次の選択: ${item.next_choice}`,
          ],
        });
      }
    }
    const meetings = await this.db
      .prepare(
        `SELECT e.id,o.scheduled_at,e.entry_type,e.body FROM one_on_one_entries e JOIN one_on_ones o ON o.id=e.one_on_one_id
      WHERE o.member_id=? AND o.unit_id=? AND e.confirmed_with_member=1 AND e.provenance_type='MEMBER_CONFIRMED' AND e.confidentiality='NORMAL' ORDER BY o.scheduled_at,e.created_at`,
      )
      .bind(memberId, member.unit_id)
      .all<{
        id: string;
        scheduled_at: string;
        entry_type: string;
        body: string;
      }>();
    for (const item of futures.results)
      sourceRefs.push({ type: "FUTURE_VISION_VERSION", id: item.id });
    for (const item of entries.results)
      sourceRefs.push({ type: "SELF_ANALYSIS_ENTRY", id: item.id });
    for (const item of meetings.results)
      sourceRefs.push({ type: "ONE_ON_ONE_ENTRY", id: item.id });
    if (!sourceRefs.length)
      throw new MemberError(
        "SHARE_CONTEXT_EMPTY",
        422,
        "no_confirmed_share_content",
      );

    const exclusions = await this.db
      .prepare(
        `SELECT
      (SELECT count(*) FROM ai_suggestions s JOIN ai_requests r ON r.id=s.request_id WHERE r.member_id=?) AS ai_proposals,
      (SELECT count(*) FROM one_on_one_entries e JOIN one_on_ones o ON o.id=e.one_on_one_id WHERE o.member_id=? AND (e.confirmed_with_member=0 OR e.confidentiality='CONFIDENTIAL' OR e.provenance_type='UL_OBSERVATION')) AS internal_or_unconfirmed,
      (SELECT count(*) FROM goal_versions v JOIN goals g ON g.id=v.goal_id WHERE g.member_id=? AND (v.status<>'CONFIRMED' OR v.confidentiality='CONFIDENTIAL')) AS goal_drafts_or_confidential`,
      )
      .bind(memberId, memberId, memberId)
      .first<Record<string, number>>();
    const id = crypto.randomUUID(),
      now = new Date().toISOString(),
      expiresAt = new Date(Date.now() + 30 * 86400000).toISOString(),
      key = `share-snapshots/${id}.html`;
    const html = renderShareHtml({
      memberName: member.display_name,
      createdAt: now,
      expiresAt,
      versionLabels,
      sections: [
        {
          title: "本人理解・将来像・Why",
          items: [
            ...futures.results.map((item) => ({
              heading: item.kind,
              lines: [item.statement],
            })),
            ...entries.results.map((item) => ({
              heading: item.prompt_text ?? item.domain ?? "本人確認済み記録",
              lines: [item.response_text],
            })),
          ],
        },
        { title: "目標・SMART", items: goalItems },
        { title: "行動・成果", items: actionItems },
        { title: "進捗・振り返り", items: reflectionItems },
        {
          title: "本人と合意した1on1",
          items: meetings.results.map((item) => ({
            heading: `${item.scheduled_at} / ${item.entry_type}`,
            lines: [item.body],
          })),
        },
      ],
    });
    const checksum = await digest(html);
    await this.files.put(key, html, {
      httpMetadata: { contentType: "text/html; charset=utf-8" },
      customMetadata: { checksum, expiresAt },
    });
    try {
      await this.db.batch([
        this.db
          .prepare(
            "INSERT INTO share_snapshots(id,member_id,unit_id,r2_object_key,content_checksum,source_refs_json,exclusion_summary_json,created_by,idempotency_key,expires_at,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
          )
          .bind(
            id,
            memberId,
            member.unit_id,
            key,
            checksum,
            JSON.stringify(sourceRefs),
            JSON.stringify(exclusions ?? {}),
            principal.actorId,
            idempotencyKey,
            expiresAt,
            now,
          ),
        this.audit(
          "SHARE_SNAPSHOT_CREATED",
          principal.actorId,
          "share_snapshot",
          id,
          requestId,
          now,
        ),
      ]);
    } catch (error) {
      await this.cleanup(key);
      throw error;
    }
    return this.preview(principal, id);
  }

  async list(principal: Principal, memberId: string) {
    const member = await this.member(principal, memberId, false);
    const rows = await this.db
      .prepare(
        "SELECT id,content_checksum,source_refs_json,exclusion_summary_json,created_by,expires_at,revoked_at,version,created_at FROM share_snapshots WHERE member_id=? AND unit_id=? ORDER BY created_at DESC",
      )
      .bind(memberId, member.unit_id)
      .all<Record<string, unknown>>();
    const result = [];
    for (const row of rows.results as Array<
      Record<string, unknown> & { id: string }
    >) {
      const [tokens, confirmations] = await Promise.all([
        this.db
          .prepare(
            "SELECT id,expires_at,first_viewed_at,last_viewed_at,revoked_at,created_at FROM share_tokens WHERE snapshot_id=? ORDER BY created_at DESC",
          )
          .bind(row.id)
          .all(),
        this.db
          .prepare(
            "SELECT id,method,result,member_words,confirmed_at,recorded_by,created_at FROM share_confirmations WHERE snapshot_id=? ORDER BY confirmed_at DESC",
          )
          .bind(row.id)
          .all(),
      ]);
      result.push({
        ...row,
        tokens: tokens.results,
        confirmations: confirmations.results,
      });
    }
    return {
      memberId,
      snapshots: result,
      canEdit:
        principal.roles.includes("UL") &&
        !principal.globalUnitRead &&
        principal.capabilities.includes("UNIT_EDIT_SCOPED"),
    };
  }

  async preview(principal: Principal, id: string) {
    const snapshot = await this.snapshot(principal, id, false);
    const object = await this.files.get(snapshot.r2_object_key);
    if (!object)
      throw new MemberError(
        "RESOURCE_NOT_FOUND",
        404,
        "snapshot_content_missing",
      );
    const html = await object.text();
    if ((await digest(html)) !== snapshot.content_checksum)
      throw new MemberError(
        "SHARE_CONTENT_INVALID",
        409,
        "snapshot_checksum_mismatch",
      );
    return {
      id: snapshot.id,
      memberId: snapshot.member_id,
      expiresAt: snapshot.expires_at,
      revokedAt: snapshot.revoked_at,
      version: snapshot.version,
      sourceRefs: JSON.parse(snapshot.source_refs_json),
      exclusionSummary: JSON.parse(snapshot.exclusion_summary_json),
      html,
    };
  }

  async createToken(
    principal: Principal,
    snapshotId: string,
    version: number,
    days: number,
    idempotencyKey: string,
    requestId: string,
  ) {
    const snapshot = await this.snapshot(principal, snapshotId, true);
    const previous = await this.db
      .prepare(
        "SELECT t.id,t.expires_at,s.version FROM share_tokens t JOIN share_snapshots s ON s.id=t.snapshot_id WHERE t.snapshot_id=? AND t.created_by=? AND t.idempotency_key=?",
      )
      .bind(snapshotId, principal.actorId, idempotencyKey)
      .first<{ id: string; expires_at: string; version: number }>();
    if (previous)
      return {
        tokenId: previous.id,
        snapshotId,
        rawToken: null,
        expiresAt: previous.expires_at,
        version: previous.version,
        idempotent: true,
      };
    if (snapshot.version !== version || snapshot.revoked_at)
      throw new MemberError("VERSION_CONFLICT", 409, "snapshot_state_conflict");
    const token = rawToken(),
      hash = await digest(token),
      id = crypto.randomUUID(),
      nonce = crypto.randomUUID(),
      now = new Date().toISOString(),
      expiresAt = new Date(Date.now() + days * 86400000).toISOString();
    const results = await this.db.batch([
      this.db
        .prepare(
          "UPDATE share_snapshots SET version=version+1,mutation_nonce=?,expires_at=CASE WHEN expires_at<? THEN ? ELSE expires_at END WHERE id=? AND unit_id=? AND version=? AND revoked_at IS NULL",
        )
        .bind(
          nonce,
          expiresAt,
          expiresAt,
          snapshotId,
          snapshot.unit_id,
          version,
        ),
      this.db
        .prepare(
          "INSERT INTO share_tokens(id,snapshot_id,token_hash,expires_at,created_by,idempotency_key,created_at) SELECT ?,?,?,?,?,?,? FROM share_snapshots WHERE id=? AND version=? AND mutation_nonce=? AND revoked_at IS NULL",
        )
        .bind(
          id,
          snapshotId,
          hash,
          expiresAt,
          principal.actorId,
          idempotencyKey,
          now,
          snapshotId,
          version + 1,
          nonce,
        ),
      this.auditWhen(
        "SHARE_TOKEN_ISSUED",
        principal.actorId,
        "share_token",
        id,
        requestId,
        now,
        "EXISTS(SELECT 1 FROM share_tokens WHERE id=? AND token_hash=?)",
        [id, hash],
      ),
    ]);
    if (
      (results[0]?.meta.changes ?? 0) !== 1 ||
      (results[1]?.meta.changes ?? 0) !== 1
    ) {
      const raced = await this.db
        .prepare(
          "SELECT t.id,t.expires_at,s.version FROM share_tokens t JOIN share_snapshots s ON s.id=t.snapshot_id WHERE t.snapshot_id=? AND t.created_by=? AND t.idempotency_key=?",
        )
        .bind(snapshotId, principal.actorId, idempotencyKey)
        .first<{ id: string; expires_at: string; version: number }>();
      if (raced)
        return {
          tokenId: raced.id,
          snapshotId,
          rawToken: null,
          expiresAt: raced.expires_at,
          version: raced.version,
          idempotent: true,
        };
      throw new MemberError("VERSION_CONFLICT", 409, "snapshot_state_conflict");
    }
    return {
      tokenId: id,
      snapshotId,
      rawToken: token,
      expiresAt,
      version: version + 1,
      idempotent: false,
    };
  }

  async revokeToken(
    principal: Principal,
    tokenId: string,
    version: number,
    requestId: string,
  ) {
    const token = await this.db
      .prepare(
        `SELECT t.id,t.snapshot_id,t.revoked_at,s.unit_id,s.version FROM share_tokens t JOIN share_snapshots s ON s.id=t.snapshot_id WHERE t.id=? AND s.unit_id IN (${
          this.units(principal)
            .map(() => "?")
            .join(",") || "NULL"
        })`,
      )
      .bind(tokenId, ...this.units(principal))
      .first<{
        id: string;
        snapshot_id: string;
        revoked_at: string | null;
        unit_id: string;
        version: number;
      }>();
    if (
      !token ||
      token.version !== version ||
      token.revoked_at ||
      !principal.roles.includes("UL") ||
      principal.globalUnitRead ||
      !principal.capabilities.includes("UNIT_EDIT_SCOPED")
    )
      throw new MemberError(
        "RESOURCE_NOT_FOUND",
        404,
        "share_token_not_mutable",
      );
    const now = new Date().toISOString(),
      nonce = crypto.randomUUID();
    const results = await this.db.batch([
      this.db
        .prepare(
          "UPDATE share_snapshots SET version=version+1,mutation_nonce=? WHERE id=? AND version=?",
        )
        .bind(nonce, token.snapshot_id, version),
      this.db
        .prepare(
          "UPDATE share_tokens SET revoked_at=? WHERE id=? AND revoked_at IS NULL AND EXISTS(SELECT 1 FROM share_snapshots WHERE id=? AND version=? AND mutation_nonce=?)",
        )
        .bind(now, tokenId, token.snapshot_id, version + 1, nonce),
      this.auditWhen(
        "SHARE_TOKEN_REVOKED",
        principal.actorId,
        "share_token",
        tokenId,
        requestId,
        now,
        "EXISTS(SELECT 1 FROM share_tokens WHERE id=? AND revoked_at=?)",
        [tokenId, now],
      ),
    ]);
    if (
      (results[0]?.meta.changes ?? 0) !== 1 ||
      (results[1]?.meta.changes ?? 0) !== 1
    )
      throw new MemberError(
        "VERSION_CONFLICT",
        409,
        "share_token_state_conflict",
      );
    return { tokenId, revokedAt: now, version: version + 1 };
  }

  async confirm(
    principal: Principal,
    snapshotId: string,
    version: number,
    input: {
      method: string;
      result: string;
      memberWords: string;
      confirmedAt: string;
    },
    requestId: string,
  ) {
    const snapshot = await this.snapshot(principal, snapshotId, true);
    if (snapshot.version !== version || snapshot.revoked_at)
      throw new MemberError("VERSION_CONFLICT", 409, "snapshot_state_conflict");
    if (new Date(input.confirmedAt) > new Date())
      throw new MemberError("VALIDATION_ERROR", 422, "confirmation_in_future");
    const id = crypto.randomUUID(),
      now = new Date().toISOString(),
      nonce = crypto.randomUUID();
    const results = await this.db.batch([
      this.db
        .prepare(
          "UPDATE share_snapshots SET version=version+1,mutation_nonce=? WHERE id=? AND unit_id=? AND version=? AND revoked_at IS NULL",
        )
        .bind(nonce, snapshotId, snapshot.unit_id, version),
      this.db
        .prepare(
          "INSERT INTO share_confirmations(id,snapshot_id,method,result,member_words,confirmed_at,recorded_by,created_at) SELECT ?,?,?,?,?,?,?,? FROM share_snapshots WHERE id=? AND version=? AND mutation_nonce=? AND revoked_at IS NULL",
        )
        .bind(
          id,
          snapshotId,
          input.method,
          input.result,
          input.memberWords,
          input.confirmedAt,
          principal.actorId,
          now,
          snapshotId,
          version + 1,
          nonce,
        ),
      this.auditWhen(
        "SHARE_CONFIRMATION_RECORDED",
        principal.actorId,
        "share_snapshot",
        snapshotId,
        requestId,
        now,
        "EXISTS(SELECT 1 FROM share_confirmations WHERE id=? AND snapshot_id=?)",
        [id, snapshotId],
      ),
    ]);
    if (
      (results[0]?.meta.changes ?? 0) !== 1 ||
      (results[1]?.meta.changes ?? 0) !== 1
    )
      throw new MemberError("VERSION_CONFLICT", 409, "snapshot_state_conflict");
    return {
      confirmationId: id,
      snapshotId,
      result: input.result,
      version: version + 1,
    };
  }

  async publicHtml(token: string, requestId: string, clientId = "unknown") {
    const incident = await this.db
      .prepare(
        "SELECT maintenance_mode,share_incident_disabled FROM operational_settings WHERE id='global'",
      )
      .bind()
      .first<{ maintenance_mode: number; share_incident_disabled: number }>();
    if (incident?.maintenance_mode || incident?.share_incident_disabled)
      throw new MemberError(
        "DEPENDENCY_UNAVAILABLE",
        503,
        "share_incident_switch_enabled",
      );
    if (!/^[A-Za-z0-9_-]{43}$/.test(token))
      throw new MemberError("RESOURCE_NOT_FOUND", 404, "share_not_found");
    const now = new Date().toISOString();
    await this.enforcePublicRateLimit(clientId, now);
    const hash = await digest(token);
    const row = await this.db
      .prepare(
        `SELECT t.id AS token_id,t.snapshot_id,s.r2_object_key,s.content_checksum FROM share_tokens t JOIN share_snapshots s ON s.id=t.snapshot_id
      WHERE t.token_hash=? AND t.revoked_at IS NULL AND s.revoked_at IS NULL AND t.expires_at>? AND s.expires_at>?`,
      )
      .bind(hash, now, now)
      .first<{
        token_id: string;
        snapshot_id: string;
        r2_object_key: string;
        content_checksum: string;
      }>();
    if (!row)
      throw new MemberError("RESOURCE_NOT_FOUND", 404, "share_not_found");
    const object = await this.files.get(row.r2_object_key);
    if (!object)
      throw new MemberError("RESOURCE_NOT_FOUND", 404, "share_not_found");
    const html = await object.text();
    if ((await digest(html)) !== row.content_checksum)
      throw new MemberError("RESOURCE_NOT_FOUND", 404, "share_not_found");
    const viewed = await this.db.batch([
      this.db
        .prepare(
          "UPDATE share_tokens SET first_viewed_at=coalesce(first_viewed_at,?),last_viewed_at=? WHERE id=? AND revoked_at IS NULL AND expires_at>? AND EXISTS(SELECT 1 FROM share_snapshots WHERE id=? AND revoked_at IS NULL AND expires_at>?)",
        )
        .bind(now, now, row.token_id, now, row.snapshot_id, now),
      this.auditWhen(
        "SHARE_TOKEN_VIEWED",
        null,
        "share_token",
        row.token_id,
        requestId,
        now,
        "EXISTS(SELECT 1 FROM share_tokens WHERE id=? AND last_viewed_at=?)",
        [row.token_id, now],
      ),
    ]);
    if ((viewed[0]?.meta.changes ?? 0) !== 1)
      throw new MemberError("RESOURCE_NOT_FOUND", 404, "share_not_found");
    return html;
  }
}
