import type { Principal } from "../auth/types";
import { MemberError } from "../member/errors";
import { SelfUnderstandingRepository } from "../self-understanding/repository";
import type { z } from "zod";
import type {
  actionInput,
  evidenceInput,
  finalizeInput,
  goalInput,
} from "./schemas";
type DB = Pick<D1Database, "prepare" | "batch">;
type Goal = z.infer<typeof goalInput>;
export class GoalRepository {
  constructor(private db: DB) {}
  private async unit(p: Principal, memberId: string, write = false) {
    const unit = await new SelfUnderstandingRepository(this.db).memberUnit(
      p,
      memberId,
      write,
    );
    if (!unit)
      throw new MemberError("RESOURCE_NOT_FOUND", 404, "goal_not_visible");
    return unit;
  }
  private audit(
    type: string,
    p: Principal,
    id: string,
    rid: string,
    now: string,
  ) {
    return this.db
      .prepare(
        "INSERT INTO audit_events(id,event_type,occurred_at,actor_id,target_type,target_id,outcome,reason,request_id,metadata_json) VALUES(?,?,?,?, 'goal',?,'SUCCEEDED','operation_succeeded',?,'{}')",
      )
      .bind(crypto.randomUUID(), type, now, p.actorId, id, rid);
  }
  async list(p: Principal, memberId: string) {
    const unit = await this.unit(p, memberId);
    const acl = `AND ((v.confidentiality='NORMAL' AND v.visibility='UL_AND_EXEC') OR v.created_by=? OR EXISTS (SELECT 1 FROM record_access_grants a WHERE a.resource_type='GOAL_VERSION' AND a.resource_id=v.id AND a.actor_id=? AND (a.expires_at IS NULL OR a.expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now'))))`;
    const goals = await this.db
      .prepare(
        `SELECT g.*,v.title,v.description,v.target_date,v.success_criteria,v.entry_route,v.provenance_type,v.confidentiality,v.version_no FROM goals g JOIN goal_versions v ON v.id=g.current_version_id WHERE g.member_id=? AND g.unit_id=? ${acl} ORDER BY g.updated_at DESC`,
      )
      .bind(memberId, unit, p.actorId, p.actorId)
      .all();
    const details = [];
    for (const goal of goals.results as {
      id: string;
      current_version_id: string;
    }[]) {
      const [versions, smart, actions, evidence, links] = await Promise.all([
        this.db
          .prepare(
            "SELECT id,version_no,title,status,change_reason,created_at FROM goal_versions WHERE goal_id=? ORDER BY version_no DESC",
          )
          .bind(goal.id)
          .all(),
        this.db
          .prepare("SELECT * FROM smart_audits WHERE goal_version_id=?")
          .bind(goal.current_version_id)
          .first(),
        this.db
          .prepare(
            "SELECT * FROM action_items WHERE goal_version_id=? ORDER BY sort_order,created_at",
          )
          .bind(goal.current_version_id)
          .all(),
        this.db
          .prepare(
            "SELECT e.* FROM evidence e WHERE e.goal_version_id=? ORDER BY e.created_at",
          )
          .bind(goal.current_version_id)
          .all(),
        this.db
          .prepare(
            "SELECT link_type,reference_id,relevance_note FROM goal_links WHERE goal_version_id=?",
          )
          .bind(goal.current_version_id)
          .all(),
      ]);
      details.push({
        ...goal,
        versions: versions.results,
        smart,
        actions: actions.results,
        evidence: evidence.results,
        links: links.results,
      });
    }
    return {
      canEdit:
        p.capabilities.includes("UNIT_EDIT_SCOPED") &&
        p.unitScopes.some((s) => s.unitId === unit),
      goals: details,
    };
  }
  async create(p: Principal, memberId: string, input: Goal, rid: string) {
    const unit = await this.unit(p, memberId, true),
      id = crypto.randomUUID(),
      vid = crypto.randomUUID(),
      now = new Date().toISOString();
    const statements = [
      this.db
        .prepare(
          "INSERT INTO goals(id,member_id,unit_id,parent_goal_id,current_version_id,lifecycle_status,owner_type,version,created_by,created_at,updated_at) VALUES(?,?,?,?,NULL,'DRAFT','MEMBER',1,?,?,?)",
        )
        .bind(
          id,
          memberId,
          unit,
          input.parentGoalId ?? null,
          p.actorId,
          now,
          now,
        ),
      this.db
        .prepare(
          "INSERT INTO goal_versions VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        )
        .bind(
          vid,
          id,
          1,
          input.entryRoute,
          input.title,
          input.description,
          input.targetDate ?? null,
          input.successCriteria,
          input.reviewCycle ?? null,
          "DRAFT",
          null,
          input.provenanceType,
          input.confidentiality,
          input.visibility,
          input.aiSendPolicy,
          p.actorId,
          null,
          now,
        ),
      this.db
        .prepare("UPDATE goals SET current_version_id=? WHERE id=?")
        .bind(vid, id),
      ...input.links.map((l) =>
        this.db
          .prepare("INSERT INTO goal_links VALUES(?,?,?,?,?,?,?)")
          .bind(
            crypto.randomUUID(),
            vid,
            l.type,
            l.referenceId,
            l.relevanceNote,
            p.actorId,
            now,
          ),
      ),
      this.audit("GOAL_CREATED", p, id, rid, now),
    ];
    try {
      await this.db.batch(statements);
    } catch {
      throw new MemberError(
        "GOAL_STATE_CONFLICT",
        409,
        "goal_integrity_conflict",
      );
    }
    return this.list(p, memberId);
  }
  private async owned(
    p: Principal,
    memberId: string,
    goalId: string,
    write = false,
  ) {
    const unit = await this.unit(p, memberId, write);
    const row = await this.db
      .prepare(
        "SELECT id,current_version_id,version FROM goals WHERE id=? AND member_id=? AND unit_id=?",
      )
      .bind(goalId, memberId, unit)
      .first<{ id: string; current_version_id: string; version: number }>();
    if (!row)
      throw new MemberError("RESOURCE_NOT_FOUND", 404, "goal_not_visible");
    return row;
  }
  async finalize(
    p: Principal,
    memberId: string,
    goalId: string,
    input: z.infer<typeof finalizeInput>,
    rid: string,
  ) {
    const goal = await this.owned(p, memberId, goalId, true);
    if (goal.version !== input.version)
      throw new MemberError("VERSION_CONFLICT", 409, "version_conflict");
    const now = new Date().toISOString(),
      s = input.smart;
    const results = await this.db.batch([
      this.db
        .prepare(
          "UPDATE goal_versions SET provenance_type='MEMBER_CONFIRMED',confirmed_at=?,status='CONFIRMED' WHERE id=? AND status IN ('DRAFT','REVIEW','AWAITING_MEMBER_CONFIRMATION')",
        )
        .bind(input.confirmedAt, goal.current_version_id),
      this.db
        .prepare(
          "INSERT INTO smart_audits VALUES(?,?,1,?,?,?,?,?,?,?,?,?,'UL_MANUAL',?,?,?)",
        )
        .bind(
          crypto.randomUUID(),
          goal.current_version_id,
          s.specific,
          s.measurable,
          s.achievable,
          s.relevant,
          s.timeBound,
          JSON.stringify(s.reasons),
          s.exceptionReason ?? null,
          s.alternativeReviewMethod ?? null,
          s.exceptionReviewDate ?? null,
          p.actorId,
          now,
        ),
      this.db
        .prepare("INSERT INTO goal_confirmations VALUES(?,?,?,?,?,?,?,?,?)")
        .bind(
          crypto.randomUUID(),
          goal.current_version_id,
          input.method,
          "APPROVED",
          input.memberWords,
          JSON.stringify(input.checks),
          input.confirmedAt,
          p.actorId,
          now,
        ),
      this.db
        .prepare(
          "UPDATE goals SET lifecycle_status='CONFIRMED',version=version+1,updated_at=? WHERE id=? AND version=?",
        )
        .bind(now, goalId, input.version),
      this.audit("GOAL_CONFIRMED", p, goalId, rid, now),
    ]);
    if ((results[3]?.meta?.changes ?? 0) !== 1)
      throw new MemberError("VERSION_CONFLICT", 409, "version_conflict");
    return this.list(p, memberId);
  }
  async action(
    p: Principal,
    memberId: string,
    goalId: string,
    input: z.infer<typeof actionInput>,
    rid: string,
  ) {
    const g = await this.owned(p, memberId, goalId, true);
    if (g.version !== input.version)
      throw new MemberError("VERSION_CONFLICT", 409, "version_conflict");
    const now = new Date().toISOString();
    await this.db.batch([
      this.db
        .prepare("INSERT INTO action_items VALUES(?,?,?,?,?,?,'TODO',0,?,?,?)")
        .bind(
          crypto.randomUUID(),
          g.current_version_id,
          memberId,
          p.actorId,
          input.title,
          input.dueAt ?? null,
          input.expectedEvidence ?? null,
          input.provenanceType,
          now,
        ),
      this.audit("GOAL_ACTION_CREATED", p, goalId, rid, now),
    ]);
    return this.list(p, memberId);
  }
  async evidence(
    p: Principal,
    memberId: string,
    goalId: string,
    input: z.infer<typeof evidenceInput>,
    rid: string,
  ) {
    const g = await this.owned(p, memberId, goalId, true);
    if (g.version !== input.version)
      throw new MemberError("VERSION_CONFLICT", 409, "version_conflict");
    const now = new Date().toISOString();
    try {
      await this.db.batch([
        this.db
          .prepare("INSERT INTO evidence VALUES(?,?,?,?,?,?,?,?,?,?,?,?)")
          .bind(
            crypto.randomUUID(),
            input.actionId,
            g.current_version_id,
            memberId,
            input.kind,
            input.description,
            input.referenceUri ?? null,
            input.occurredOn ?? null,
            input.verificationStatus,
            input.provenanceType,
            p.actorId,
            now,
          ),
        this.audit("GOAL_EVIDENCE_CREATED", p, goalId, rid, now),
      ]);
    } catch {
      throw new MemberError(
        "GOAL_STATE_CONFLICT",
        409,
        "evidence_integrity_conflict",
      );
    }
    return this.list(p, memberId);
  }
}
