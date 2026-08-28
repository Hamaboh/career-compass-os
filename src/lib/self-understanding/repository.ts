import { repositoryUnitScope } from "../auth/policy";
import type { Principal } from "../auth/types";
import { MemberError } from "../member/errors";
import type { z } from "zod";
import type { entryInput, visionInput } from "./schemas";

type EntryInput = z.infer<typeof entryInput>;
type VisionInput = z.infer<typeof visionInput>;

type DB = Pick<D1Database, "prepare" | "batch">;
const qs = (n: number) => Array.from({ length: n }, () => "?").join(",");
export class SelfUnderstandingRepository {
  constructor(private db: DB) {}
  private scope(p: Principal, write = false) {
    const s = repositoryUnitScope(p);
    return {
      global:
        (!write && s.global) || (write && p.roles.includes("SYSTEM_ADMIN")),
      ids: s.unitIds,
    };
  }
  async memberUnit(p: Principal, memberId: string, write = false) {
    const s = this.scope(p, write);
    if (!s.global && !s.ids.length) return null;
    const pred = s.global ? "" : `AND h.unit_id IN (${qs(s.ids.length)})`;
    const row = await this.db
      .prepare(
        `SELECT h.unit_id FROM members m JOIN member_unit_history h ON h.member_id=m.id AND h.is_primary=1 AND h.started_on<=date('now') AND (h.ended_on IS NULL OR h.ended_on>date('now')) WHERE m.id=? ${pred}`,
      )
      .bind(memberId, ...s.ids)
      .first<{ unit_id: string }>();
    return row?.unit_id ?? null;
  }
  async overview(p: Principal, memberId: string) {
    const unit = await this.memberUnit(p, memberId);
    if (!unit)
      throw new MemberError("RESOURCE_NOT_FOUND", 404, "member_not_visible");
    const entryAcl = `AND (
      (e.confidentiality='NORMAL' AND e.visibility='UL_AND_EXEC')
      OR e.created_by=?
      OR EXISTS (
        SELECT 1 FROM record_access_grants acl
        WHERE acl.resource_type='SELF_ANALYSIS_ENTRY' AND acl.resource_id=e.id
          AND acl.actor_id=? AND (acl.expires_at IS NULL OR acl.expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      )
    )`;
    const visionAcl = `AND (
      (v.confidentiality='NORMAL' AND v.visibility='UL_AND_EXEC')
      OR v.created_by=?
      OR EXISTS (
        SELECT 1 FROM record_access_grants acl
        WHERE acl.resource_type='FUTURE_VISION_VERSION' AND acl.resource_id=v.id
          AND acl.actor_id=? AND (acl.expires_at IS NULL OR acl.expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      )
    )`;
    const sessions = await this.db
      .prepare(
        "SELECT id,route_type,status,version,started_at,completed_at FROM self_analysis_sessions WHERE member_id=? AND unit_id=? ORDER BY started_at DESC",
      )
      .bind(memberId, unit)
      .all();
    const entries = await this.db
      .prepare(
        `SELECT e.* FROM self_analysis_entries e JOIN self_analysis_sessions s ON s.id=e.session_id WHERE s.member_id=? AND s.unit_id=? ${entryAcl} ORDER BY e.created_at`,
      )
      .bind(memberId, unit, p.actorId, p.actorId)
      .all();
    const questions = await this.db
      .prepare(
        "SELECT q.id,q.session_id,q.domain,q.prompt_text,q.position,q.version FROM self_analysis_questions q JOIN self_analysis_sessions s ON s.id=q.session_id WHERE s.member_id=? AND s.unit_id=? ORDER BY s.started_at DESC,q.position",
      )
      .bind(memberId, unit)
      .all();
    const entryHistory = await this.db
      .prepare(
        `SELECT h.id,h.entry_id,h.version,h.response_status,h.response_text,h.provenance_type,h.confidentiality,h.visibility,h.ai_send_policy,h.confirmed_at,h.changed_at
         FROM self_analysis_entry_history h
         JOIN self_analysis_entries e ON e.id=h.entry_id
         JOIN self_analysis_sessions s ON s.id=e.session_id
         WHERE s.member_id=? AND s.unit_id=? ${entryAcl}
         ORDER BY h.changed_at DESC`,
      )
      .bind(memberId, unit, p.actorId, p.actorId)
      .all();
    const visions = await this.db
      .prepare(
        `SELECT v.* FROM future_vision_versions v WHERE v.member_id=? AND v.unit_id=? ${visionAcl} ORDER BY v.kind,v.version DESC`,
      )
      .bind(memberId, unit, p.actorId, p.actorId)
      .all();
    return {
      canEdit:
        p.capabilities.includes("UNIT_EDIT_SCOPED") &&
        p.unitScopes.some((item) => item.unitId === unit),
      sessions: sessions.results,
      questions: questions.results,
      entries: entries.results,
      entryHistory: entryHistory.results,
      futureVisions: visions.results,
    };
  }
  private audit(
    type: string,
    p: Principal,
    target: string,
    rid: string,
    now: string,
  ) {
    return this.db
      .prepare(
        "INSERT INTO audit_events(id,event_type,occurred_at,actor_id,target_type,target_id,outcome,reason,request_id,metadata_json) VALUES(?,?,?,?,?,?,'SUCCEEDED','operation_succeeded',?,'{}')",
      )
      .bind(
        crypto.randomUUID(),
        type,
        now,
        p.actorId,
        "self_understanding",
        target,
        rid,
      );
  }
  private conditionalAudit(
    type: string,
    p: Principal,
    target: string,
    rid: string,
    now: string,
  ) {
    return this.db
      .prepare(
        "INSERT INTO audit_events(id,event_type,occurred_at,actor_id,target_type,target_id,outcome,reason,request_id,metadata_json) SELECT ?,?,?,?,?,?,'SUCCEEDED','operation_succeeded',?,'{}' WHERE changes()=1",
      )
      .bind(
        crypto.randomUUID(),
        type,
        now,
        p.actorId,
        "self_understanding",
        target,
        rid,
      );
  }
  async createSession(
    p: Principal,
    memberId: string,
    input: { routeType: string; status: string },
    rid: string,
  ) {
    const unit = await this.memberUnit(p, memberId, true);
    if (!unit)
      throw new MemberError("RESOURCE_NOT_FOUND", 404, "member_not_visible");
    const id = crypto.randomUUID(),
      now = new Date().toISOString();
    await this.db.batch([
      this.db
        .prepare(
          "INSERT INTO self_analysis_sessions(id,member_id,unit_id,route_type,status,version,started_at,created_by,created_at,updated_at) VALUES(?,?,?,?,?,1,?,?,?,?)",
        )
        .bind(
          id,
          memberId,
          unit,
          input.routeType,
          input.status,
          now,
          p.actorId,
          now,
          now,
        ),
      this.audit("SELF_ANALYSIS_SESSION_CREATED", p, id, rid, now),
    ]);
    return this.overview(p, memberId);
  }
  async addQuestion(
    p: Principal,
    sessionId: string,
    input: { domain: string; promptText: string; position: number },
    rid: string,
  ) {
    const row = await this.session(p, sessionId, true),
      id = crypto.randomUUID(),
      now = new Date().toISOString();
    await this.db.batch([
      this.db
        .prepare(
          "INSERT INTO self_analysis_questions VALUES(?,?,?,?,?,1,?,?,?)",
        )
        .bind(
          id,
          sessionId,
          input.domain,
          input.promptText,
          input.position,
          p.actorId,
          now,
          now,
        ),
      this.audit("SELF_ANALYSIS_QUESTION_CREATED", p, id, rid, now),
    ]);
    return this.overview(p, row.member_id);
  }
  async updateQuestion(
    p: Principal,
    sessionId: string,
    questionId: string,
    input: {
      domain: string;
      promptText: string;
      position: number;
      version: number;
    },
    rid: string,
  ) {
    const row = await this.session(p, sessionId, true);
    const current = await this.db
      .prepare(
        "SELECT id,domain,prompt_text,position,version FROM self_analysis_questions WHERE id=? AND session_id=?",
      )
      .bind(questionId, sessionId)
      .first<Record<string, unknown>>();
    if (!current)
      throw new MemberError("RESOURCE_NOT_FOUND", 404, "question_not_visible");
    const now = new Date().toISOString();
    const result = await this.db.batch([
      this.db
        .prepare(
          "INSERT INTO self_analysis_question_history SELECT ?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM self_analysis_questions WHERE id=? AND session_id=? AND version=?)",
        )
        .bind(
          crypto.randomUUID(),
          questionId,
          current.version,
          current.domain,
          current.prompt_text,
          current.position,
          p.actorId,
          now,
          questionId,
          sessionId,
          input.version,
        ),
      this.db
        .prepare(
          "UPDATE self_analysis_questions SET domain=?,prompt_text=?,position=?,version=version+1,updated_at=? WHERE id=? AND session_id=? AND version=?",
        )
        .bind(
          input.domain,
          input.promptText,
          input.position,
          now,
          questionId,
          sessionId,
          input.version,
        ),
      this.conditionalAudit(
        "SELF_ANALYSIS_QUESTION_UPDATED",
        p,
        questionId,
        rid,
        now,
      ),
    ]);
    if (!result[1]?.meta.changes)
      throw new MemberError("VERSION_CONFLICT", 409, "version_conflict");
    return this.overview(p, row.member_id);
  }
  async transitionSession(
    p: Principal,
    sessionId: string,
    input: { status: string; version: number },
    rid: string,
  ) {
    const row = await this.session(p, sessionId, true);
    const current = await this.db
      .prepare("SELECT * FROM self_analysis_sessions WHERE id=?")
      .bind(sessionId)
      .first<Record<string, unknown>>();
    if (!current)
      throw new MemberError("RESOURCE_NOT_FOUND", 404, "session_not_visible");
    const allowed: Record<string, string[]> = {
      ACTIVE: ["COMPLETED", "ON_HOLD", "SKIPPED"],
      ON_HOLD: ["ACTIVE", "COMPLETED", "SKIPPED"],
      SKIPPED: ["ACTIVE"],
      COMPLETED: [],
    };
    if (!allowed[String(current.status)]?.includes(input.status))
      throw new MemberError("INVALID_STATE_TRANSITION", 422, "invalid_state");
    const now = new Date().toISOString();
    const completedAt = input.status === "COMPLETED" ? now : null;
    const result = await this.db.batch([
      this.db
        .prepare(
          "INSERT INTO self_analysis_session_history SELECT ?,?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM self_analysis_sessions WHERE id=? AND version=?)",
        )
        .bind(
          crypto.randomUUID(),
          sessionId,
          current.version,
          current.route_type,
          current.status,
          current.started_at,
          current.completed_at,
          p.actorId,
          now,
          sessionId,
          input.version,
        ),
      this.db
        .prepare(
          "UPDATE self_analysis_sessions SET status=?,completed_at=?,version=version+1,updated_at=? WHERE id=? AND version=?",
        )
        .bind(input.status, completedAt, now, sessionId, input.version),
      this.conditionalAudit(
        "SELF_ANALYSIS_SESSION_TRANSITIONED",
        p,
        sessionId,
        rid,
        now,
      ),
    ]);
    if (!result[1]?.meta.changes)
      throw new MemberError("VERSION_CONFLICT", 409, "version_conflict");
    return this.overview(p, row.member_id);
  }
  async saveEntry(
    p: Principal,
    sessionId: string,
    input: EntryInput,
    rid: string,
  ) {
    const row = await this.session(p, sessionId, true),
      now = new Date().toISOString();
    if (input.version) {
      const old = await this.db
        .prepare(
          "SELECT * FROM self_analysis_entries WHERE id=? AND session_id=?",
        )
        .bind(input.entryId, sessionId)
        .first<Record<string, unknown>>();
      if (!old)
        throw new MemberError("RESOURCE_NOT_FOUND", 404, "entry_not_visible");
      const result = await this.db.batch([
        this.db
          .prepare(
            "INSERT INTO self_analysis_entry_history SELECT ?,?,?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM self_analysis_entries WHERE id=? AND session_id=? AND version=?)",
          )
          .bind(
            crypto.randomUUID(),
            old.id,
            old.version,
            old.response_status,
            old.response_text,
            old.provenance_type,
            old.confidentiality,
            old.visibility,
            old.ai_send_policy,
            old.confirmed_at,
            p.actorId,
            now,
            old.id,
            sessionId,
            input.version,
          ),
        this.db
          .prepare(
            "UPDATE self_analysis_entries SET question_id=?,response_status=?,response_text=?,provenance_type=?,confidentiality=?,visibility=?,ai_send_policy=?,confirmed_at=?,version=version+1,updated_at=? WHERE id=? AND session_id=? AND version=?",
          )
          .bind(
            input.questionId ?? null,
            input.responseStatus,
            input.responseText ?? null,
            input.provenanceType,
            input.confidentiality,
            input.visibility,
            input.aiSendPolicy,
            input.provenanceType === "MEMBER_CONFIRMED" ? now : null,
            now,
            old.id,
            sessionId,
            input.version,
          ),
        this.conditionalAudit(
          "SELF_ANALYSIS_ENTRY_UPDATED",
          p,
          String(old.id),
          rid,
          now,
        ),
      ]);
      if (!result[1]?.meta.changes)
        throw new MemberError("VERSION_CONFLICT", 409, "version_conflict");
    } else {
      const id = crypto.randomUUID();
      await this.db.batch([
        this.db
          .prepare(
            "INSERT INTO self_analysis_entries VALUES(?,?,?,?,?,?,?,?,?,?,?,1,?,?,?)",
          )
          .bind(
            id,
            sessionId,
            input.questionId ?? null,
            input.responseStatus,
            input.responseText ?? null,
            input.provenanceType,
            input.confidentiality,
            input.visibility,
            input.aiSendPolicy,
            input.provenanceType === "MEMBER_CONFIRMED" ? now : null,
            p.actorId,
            now,
            now,
          ),
        this.audit("SELF_ANALYSIS_ENTRY_CREATED", p, id, rid, now),
      ]);
    }
    return this.overview(p, row.member_id);
  }
  async createVision(
    p: Principal,
    memberId: string,
    input: VisionInput,
    rid: string,
  ) {
    const unit = await this.memberUnit(p, memberId, true);
    if (!unit)
      throw new MemberError("RESOURCE_NOT_FOUND", 404, "member_not_visible");
    for (const eid of input.evidenceEntryIds) {
      const ok = await this.db
        .prepare(
          "SELECT e.id FROM self_analysis_entries e JOIN self_analysis_sessions s ON s.id=e.session_id WHERE e.id=? AND s.member_id=? AND s.unit_id=?",
        )
        .bind(eid, memberId, unit)
        .first();
      if (!ok)
        throw new MemberError("INVALID_EVIDENCE", 422, "invalid_evidence");
    }
    const id = crypto.randomUUID(),
      now = new Date().toISOString(),
      version = input.expectedVersion + 1;
    const statements = [
      this.db
        .prepare(
          `INSERT INTO future_vision_versions
           SELECT ?,?,?,?,?,?,?,?,?,?,?,
             (SELECT id FROM future_vision_versions WHERE member_id=? AND kind=? AND version=?),
             ?,?,?
           WHERE (SELECT COALESCE(MAX(version),0) FROM future_vision_versions WHERE member_id=? AND kind=?)=?`,
        )
        .bind(
          id,
          memberId,
          unit,
          input.kind,
          input.statement,
          input.status,
          input.provenanceType,
          input.confidentiality,
          input.visibility,
          input.aiSendPolicy,
          version,
          memberId,
          input.kind,
          input.expectedVersion,
          input.status === "MEMBER_CONFIRMED" ? now : null,
          p.actorId,
          now,
          memberId,
          input.kind,
          input.expectedVersion,
        ),
      ...input.evidenceEntryIds.map((eid: string) =>
        this.db
          .prepare(
            "INSERT INTO future_vision_evidence_refs SELECT ?,? WHERE EXISTS (SELECT 1 FROM future_vision_versions WHERE id=?)",
          )
          .bind(id, eid, id),
      ),
      this.db
        .prepare(
          "INSERT INTO audit_events(id,event_type,occurred_at,actor_id,target_type,target_id,outcome,reason,request_id,metadata_json) SELECT ?,'FUTURE_VISION_VERSION_CREATED',?,?, 'self_understanding',?,'SUCCEEDED','operation_succeeded',?,'{}' WHERE EXISTS (SELECT 1 FROM future_vision_versions WHERE id=?)",
        )
        .bind(crypto.randomUUID(), now, p.actorId, id, rid, id),
    ];
    try {
      const result = await this.db.batch(statements);
      if (!result[0]?.meta.changes)
        throw new MemberError("VERSION_CONFLICT", 409, "version_conflict");
    } catch (error) {
      if (
        error instanceof MemberError ||
        (error instanceof Error &&
          /UNIQUE constraint failed: future_vision_versions\.(member_id|id)/.test(
            error.message,
          ))
      )
        throw new MemberError("VERSION_CONFLICT", 409, "version_conflict");
      throw error;
    }
    return this.overview(p, memberId);
  }
  async session(p: Principal, id: string, write: boolean) {
    const s = this.scope(p, write),
      pred = s.global ? "" : `AND unit_id IN (${qs(s.ids.length)})`;
    if (!s.global && !s.ids.length)
      throw new MemberError("RESOURCE_NOT_FOUND", 404, "session_not_visible");
    const row = await this.db
      .prepare(
        `SELECT member_id,unit_id FROM self_analysis_sessions WHERE id=? ${pred}`,
      )
      .bind(id, ...s.ids)
      .first<{ member_id: string; unit_id: string }>();
    if (!row)
      throw new MemberError("RESOURCE_NOT_FOUND", 404, "session_not_visible");
    return row;
  }
}
