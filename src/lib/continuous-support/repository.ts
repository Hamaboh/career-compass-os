import type { Principal } from "../auth/types";
import { MemberError } from "../member/errors";
import { SelfUnderstandingRepository } from "../self-understanding/repository";
import type { z } from "zod";
import { deterministicSupportProposals } from "./fake";
import type {
  indicatorInput,
  oneOnOneEntryInput,
  oneOnOneInput,
  oneOnOneUpdateInput,
  progressInput,
  reflectionInput,
  reminderInput,
  reminderUpdateInput,
} from "./schemas";

type DB = Pick<D1Database, "prepare" | "batch">;
type GoalRow = {
  id: string;
  current_version_id: string;
  version: number;
  unit_id: string;
};

async function deterministicUuid(value: string) {
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  ).slice(0, 16);
  digest[6] = (digest[6]! & 0x0f) | 0x50;
  digest[8] = (digest[8]! & 0x3f) | 0x80;
  const hex = [...digest]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export class ContinuousSupportRepository {
  constructor(private db: DB) {}

  private async unit(principal: Principal, memberId: string, write = false) {
    const unitId = await new SelfUnderstandingRepository(this.db).memberUnit(
      principal,
      memberId,
      write,
    );
    if (!unitId)
      throw new MemberError("RESOURCE_NOT_FOUND", 404, "support_not_visible");
    return unitId;
  }

  private audit(
    eventType: string,
    principal: Principal,
    targetType: string,
    targetId: string,
    requestId: string,
    now: string,
    conditional = false,
  ) {
    const values = conditional
      ? "SELECT ?,?,?,?,?,?,'SUCCEEDED','operation_succeeded',?,'{}' WHERE changes()=1"
      : "VALUES (?,?,?,?,?,?,'SUCCEEDED','operation_succeeded',?,'{}')";
    return this.db
      .prepare(
        `INSERT INTO audit_events(id,event_type,occurred_at,actor_id,target_type,target_id,outcome,reason,request_id,metadata_json) ${values}`,
      )
      .bind(
        crypto.randomUUID(),
        eventType,
        now,
        principal.actorId,
        targetType,
        targetId,
        requestId,
      );
  }

  private async goal(
    principal: Principal,
    memberId: string,
    goalId: string,
    write = false,
  ) {
    const unitId = await this.unit(principal, memberId, write);
    const row = await this.db
      .prepare(
        `SELECT g.id,g.current_version_id,g.version,g.unit_id
         FROM goals g JOIN goal_versions v ON v.id=g.current_version_id
         WHERE g.id=? AND g.member_id=? AND g.unit_id=?
           AND ((v.confidentiality='NORMAL' AND v.visibility='UL_AND_EXEC') OR g.created_by=? OR EXISTS (
             SELECT 1 FROM record_access_grants a
             WHERE a.resource_type='GOAL_VERSION' AND a.resource_id=v.id AND a.actor_id=?
               AND (a.expires_at IS NULL OR a.expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now'))))`,
      )
      .bind(goalId, memberId, unitId, principal.actorId, principal.actorId)
      .first<GoalRow>();
    if (!row)
      throw new MemberError("RESOURCE_NOT_FOUND", 404, "goal_not_visible");
    return row;
  }

  async overview(principal: Principal, memberId: string) {
    const unitId = await this.unit(principal, memberId);
    const goals = await this.db
      .prepare(
        `SELECT g.id,g.version,g.lifecycle_status,g.current_version_id,v.title,v.version_no,v.target_date,v.review_cycle
         FROM goals g JOIN goal_versions v ON v.id=g.current_version_id
         WHERE g.member_id=? AND g.unit_id=?
           AND ((v.confidentiality='NORMAL' AND v.visibility='UL_AND_EXEC') OR g.created_by=? OR EXISTS (
             SELECT 1 FROM record_access_grants a WHERE a.resource_type='GOAL_VERSION'
               AND a.resource_id=v.id AND a.actor_id=?
               AND (a.expires_at IS NULL OR a.expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now'))))
         ORDER BY g.updated_at DESC`,
      )
      .bind(memberId, unitId, principal.actorId, principal.actorId)
      .all<GoalRow>();
    const goalDetails = [];
    for (const goal of goals.results as (GoalRow & { title: string })[]) {
      const versionAcl = `AND ((v.confidentiality='NORMAL' AND v.visibility='UL_AND_EXEC') OR g.created_by=? OR EXISTS (
        SELECT 1 FROM record_access_grants a WHERE a.resource_type='GOAL_VERSION' AND a.resource_id=v.id AND a.actor_id=?
        AND (a.expires_at IS NULL OR a.expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now'))))`;
      const [progress, reflections, indicators, suggestions, actions] =
        await Promise.all([
          this.db
            .prepare(
              `SELECT p.* FROM progress_entries p JOIN goal_versions v ON v.id=p.goal_version_id JOIN goals g ON g.id=p.goal_id
               WHERE p.goal_id=? ${versionAcl} AND (p.confidentiality='NORMAL' OR p.recorded_by=? OR EXISTS (
                 SELECT 1 FROM record_access_grants pa WHERE pa.resource_type='PROGRESS_ENTRY' AND pa.resource_id=p.id AND pa.actor_id=?
                 AND (pa.expires_at IS NULL OR pa.expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now')))) ORDER BY p.recorded_at DESC`,
            )
            .bind(
              goal.id,
              principal.actorId,
              principal.actorId,
              principal.actorId,
              principal.actorId,
            )
            .all(),
          this.db
            .prepare(
              `SELECT r.* FROM reflections r JOIN goal_versions v ON v.id=r.goal_version_id JOIN goals g ON g.id=r.goal_id
               WHERE r.goal_id=? ${versionAcl} AND (r.confidentiality='NORMAL' OR r.recorded_by=? OR EXISTS (
                 SELECT 1 FROM record_access_grants ra WHERE ra.resource_type='REFLECTION' AND ra.resource_id=r.id AND ra.actor_id=?
                 AND (ra.expires_at IS NULL OR ra.expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now')))) ORDER BY r.period_end DESC`,
            )
            .bind(
              goal.id,
              principal.actorId,
              principal.actorId,
              principal.actorId,
              principal.actorId,
            )
            .all(),
          this.db
            .prepare(
              `SELECT i.* FROM goal_indicators i JOIN goal_versions v ON v.id=i.goal_version_id JOIN goals g ON g.id=i.goal_id
               WHERE i.goal_id=? ${versionAcl} ORDER BY i.recorded_at DESC`,
            )
            .bind(goal.id, principal.actorId, principal.actorId)
            .all(),
          this.db
            .prepare(
              `SELECT s.* FROM support_suggestions s JOIN goal_versions v ON v.id=s.goal_version_id JOIN goals g ON g.id=s.goal_id
               WHERE s.goal_id=? ${versionAcl} ORDER BY s.created_at DESC`,
            )
            .bind(goal.id, principal.actorId, principal.actorId)
            .all(),
          this.db
            .prepare(
              "SELECT id,title,status,due_date,version FROM action_items WHERE goal_version_id=? AND member_id=? ORDER BY position,id",
            )
            .bind(goal.current_version_id, memberId)
            .all(),
        ]);
      goalDetails.push({
        ...goal,
        progress: progress.results,
        reflections: reflections.results,
        indicators: indicators.results,
        suggestions: suggestions.results,
        actions: actions.results,
      });
    }
    const oneOnOnes = await this.db
      .prepare(
        "SELECT * FROM one_on_ones WHERE member_id=? AND unit_id=? ORDER BY scheduled_at DESC",
      )
      .bind(memberId, unitId)
      .all();
    const meetings = [];
    for (const meeting of oneOnOnes.results as { id: string }[]) {
      const entries = await this.db
        .prepare(
          `SELECT e.* FROM one_on_one_entries e
           WHERE e.one_on_one_id=? AND (e.confidentiality='NORMAL' OR e.created_by=? OR EXISTS (
             SELECT 1 FROM record_access_grants a WHERE a.resource_type='ONE_ON_ONE_ENTRY'
             AND a.resource_id=e.id AND a.actor_id=?
             AND (a.expires_at IS NULL OR a.expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now'))))
           ORDER BY e.created_at`,
        )
        .bind(meeting.id, principal.actorId, principal.actorId)
        .all();
      meetings.push({ ...meeting, entries: entries.results });
    }
    const reminders = await this.db
      .prepare(
        "SELECT * FROM reminder_rules WHERE member_id=? AND unit_id=? AND recipient_user_id=? ORDER BY next_run_at",
      )
      .bind(memberId, unitId, principal.actorId)
      .all();
    return {
      canEdit:
        principal.capabilities.includes("UNIT_EDIT_SCOPED") &&
        principal.unitScopes.some((scope) => scope.unitId === unitId),
      goals: goalDetails,
      oneOnOnes: meetings,
      reminders: reminders.results,
    };
  }

  async addProgress(
    principal: Principal,
    memberId: string,
    goalId: string,
    input: z.infer<typeof progressInput>,
    requestId: string,
  ) {
    const goal = await this.goal(principal, memberId, goalId, true);
    if (goal.version !== input.version)
      throw new MemberError("VERSION_CONFLICT", 409, "version_conflict");
    const now = new Date().toISOString();
    try {
      await this.db.batch([
        this.db
          .prepare(
            "INSERT INTO progress_entries VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
          )
          .bind(
            crypto.randomUUID(),
            goalId,
            goal.current_version_id,
            memberId,
            goal.unit_id,
            input.state,
            input.percent ?? null,
            input.selfRating ?? null,
            input.note,
            input.blocker,
            input.nextCheckAt ?? null,
            input.provenanceType,
            input.confidentiality,
            input.aiSendPolicy,
            principal.actorId,
            now,
          ),
        this.audit(
          "GOAL_PROGRESS_RECORDED",
          principal,
          "goal",
          goalId,
          requestId,
          now,
        ),
      ]);
    } catch {
      throw new MemberError("VERSION_CONFLICT", 409, "revision_conflict");
    }
    return this.overview(principal, memberId);
  }

  async addReflection(
    principal: Principal,
    memberId: string,
    goalId: string,
    input: z.infer<typeof reflectionInput>,
    requestId: string,
  ) {
    const goal = await this.goal(principal, memberId, goalId, true);
    if (goal.version !== input.version)
      throw new MemberError("VERSION_CONFLICT", 409, "version_conflict");
    const now = new Date().toISOString();
    try {
      await this.db.batch([
        this.db
          .prepare(
            "INSERT INTO reflections VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
          )
          .bind(
            crypto.randomUUID(),
            goalId,
            goal.current_version_id,
            memberId,
            goal.unit_id,
            input.periodStart,
            input.periodEnd,
            input.outcome,
            input.learning,
            input.feeling,
            input.nextChoice,
            input.provenanceType,
            input.confidentiality,
            input.aiSendPolicy,
            principal.actorId,
            now,
          ),
        this.audit(
          "GOAL_REFLECTION_RECORDED",
          principal,
          "goal",
          goalId,
          requestId,
          now,
        ),
      ]);
    } catch {
      throw new MemberError("VERSION_CONFLICT", 409, "revision_conflict");
    }
    return this.overview(principal, memberId);
  }

  async addIndicator(
    principal: Principal,
    memberId: string,
    goalId: string,
    input: z.infer<typeof indicatorInput>,
    requestId: string,
  ) {
    const goal = await this.goal(principal, memberId, goalId, true);
    if (goal.version !== input.version)
      throw new MemberError("VERSION_CONFLICT", 409, "version_conflict");
    const now = new Date().toISOString();
    try {
      await this.db.batch([
        this.db
          .prepare("INSERT INTO goal_indicators VALUES(?,?,?,?,?,?,?,?,?,?,?)")
          .bind(
            crypto.randomUUID(),
            goalId,
            goal.current_version_id,
            memberId,
            goal.unit_id,
            input.metricType,
            input.value,
            input.sourceType,
            input.basisNote,
            principal.actorId,
            now,
          ),
        this.audit(
          "GOAL_INDICATOR_RECORDED",
          principal,
          "goal",
          goalId,
          requestId,
          now,
        ),
      ]);
    } catch {
      throw new MemberError("VERSION_CONFLICT", 409, "revision_conflict");
    }
    return this.overview(principal, memberId);
  }

  async createSuggestions(
    principal: Principal,
    memberId: string,
    goalId: string,
    version: number,
    requestId: string,
  ) {
    const goal = await this.goal(principal, memberId, goalId, true);
    if (goal.version !== version)
      throw new MemberError("VERSION_CONFLICT", 409, "version_conflict");
    const now = new Date().toISOString();
    try {
      await this.db.batch([
        ...deterministicSupportProposals().map((proposal) =>
          this.db
            .prepare(
              "INSERT INTO support_suggestions VALUES(?,?,?,?,?,?,?,?,?,?,'PROPOSAL','PENDING',?,?)",
            )
            .bind(
              crypto.randomUUID(),
              goalId,
              goal.current_version_id,
              memberId,
              goal.unit_id,
              proposal.type,
              proposal.content,
              proposal.rationale,
              "AI_SUGGESTION",
              "DETERMINISTIC_FAKE",
              principal.actorId,
              now,
            ),
        ),
        this.audit(
          "SUPPORT_PROPOSALS_CREATED",
          principal,
          "goal",
          goalId,
          requestId,
          now,
        ),
      ]);
    } catch {
      throw new MemberError("VERSION_CONFLICT", 409, "revision_conflict");
    }
    return this.overview(principal, memberId);
  }

  async createOneOnOne(
    principal: Principal,
    memberId: string,
    input: z.infer<typeof oneOnOneInput>,
    requestId: string,
  ) {
    const unitId = await this.unit(principal, memberId, true);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await this.db.batch([
      this.db
        .prepare(
          "INSERT INTO one_on_ones VALUES(?,?,?,?,?,NULL,'SCHEDULED',?,?,1,?,?)",
        )
        .bind(
          id,
          memberId,
          unitId,
          principal.actorId,
          input.scheduledAt,
          input.theme,
          input.nextAt ?? null,
          now,
          now,
        ),
      this.audit(
        "ONE_ON_ONE_CREATED",
        principal,
        "one_on_one",
        id,
        requestId,
        now,
      ),
    ]);
    return this.overview(principal, memberId);
  }

  private async meeting(
    principal: Principal,
    memberId: string,
    meetingId: string,
    write = false,
  ) {
    const unitId = await this.unit(principal, memberId, write);
    const row = await this.db
      .prepare(
        "SELECT * FROM one_on_ones WHERE id=? AND member_id=? AND unit_id=?",
      )
      .bind(meetingId, memberId, unitId)
      .first<{ id: string; version: number }>();
    if (!row)
      throw new MemberError("RESOURCE_NOT_FOUND", 404, "meeting_not_visible");
    return row;
  }

  async updateOneOnOne(
    principal: Principal,
    memberId: string,
    meetingId: string,
    input: z.infer<typeof oneOnOneUpdateInput>,
    requestId: string,
  ) {
    const meeting = await this.meeting(principal, memberId, meetingId, true);
    if (meeting.version !== input.version)
      throw new MemberError("VERSION_CONFLICT", 409, "version_conflict");
    const now = new Date().toISOString();
    const results = await this.db.batch([
      this.db
        .prepare(
          "UPDATE one_on_ones SET status=?,held_at=?,next_at=?,theme=?,version=version+1,updated_at=? WHERE id=? AND version=?",
        )
        .bind(
          input.status,
          input.heldAt ?? null,
          input.nextAt ?? null,
          input.theme,
          now,
          meetingId,
          input.version,
        ),
      this.audit(
        "ONE_ON_ONE_UPDATED",
        principal,
        "one_on_one",
        meetingId,
        requestId,
        now,
        true,
      ),
    ]);
    if ((results[0]?.meta?.changes ?? 0) !== 1)
      throw new MemberError("VERSION_CONFLICT", 409, "version_conflict");
    return this.overview(principal, memberId);
  }

  async addOneOnOneEntry(
    principal: Principal,
    memberId: string,
    meetingId: string,
    input: z.infer<typeof oneOnOneEntryInput>,
    requestId: string,
  ) {
    const meeting = await this.meeting(principal, memberId, meetingId, true);
    if (meeting.version !== input.version)
      throw new MemberError("VERSION_CONFLICT", 409, "version_conflict");
    const entryId = crypto.randomUUID();
    const now = new Date().toISOString();
    let results: D1Result<unknown>[];
    try {
      results = await this.db.batch([
        this.db
          .prepare(
            `INSERT INTO one_on_one_entries(id,one_on_one_id,goal_version_id,entry_type,body,provenance_type,confidentiality,ai_send_policy,confirmed_with_member,confirmation_method,confirmed_at,member_confirmation_words,created_by,created_at)
             SELECT ?,o.id,?,?,?,?,?,?,?,?,?,?,?,?,? FROM one_on_ones o WHERE o.id=? AND o.member_id=? AND o.version=?`,
          )
          .bind(
            entryId,
            input.goalVersionId ?? null,
            input.entryType,
            input.body,
            input.provenanceType,
            input.confidentiality,
            input.aiSendPolicy,
            input.confirmedWithMember ? 1 : 0,
            input.confirmationMethod ?? null,
            input.confirmedAt ?? null,
            input.memberConfirmationWords ?? null,
            principal.actorId,
            now,
            meetingId,
            memberId,
            input.version,
          ),
        this.db
          .prepare(
            "UPDATE one_on_ones SET version=version+1,updated_at=? WHERE id=? AND member_id=? AND version=? AND EXISTS(SELECT 1 FROM one_on_one_entries WHERE id=?)",
          )
          .bind(now, meetingId, memberId, input.version, entryId),
        this.audit(
          "ONE_ON_ONE_ENTRY_CREATED",
          principal,
          "one_on_one_entry",
          entryId,
          requestId,
          now,
          true,
        ),
      ]);
    } catch {
      throw new MemberError("VERSION_CONFLICT", 409, "revision_conflict");
    }
    if ((results[1]?.meta?.changes ?? 0) !== 1)
      throw new MemberError("VERSION_CONFLICT", 409, "version_conflict");
    return this.overview(principal, memberId);
  }

  async createReminder(
    principal: Principal,
    memberId: string,
    input: z.infer<typeof reminderInput>,
    requestId: string,
  ) {
    const unitId = await this.unit(principal, memberId, true);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    try {
      await this.db.batch([
        this.db
          .prepare(
            "INSERT INTO reminder_rules VALUES(?,?,?,?,?,?,?,?,?,?,1,?,1,?,?,?)",
          )
          .bind(
            id,
            memberId,
            unitId,
            input.subjectType,
            input.subjectId,
            input.reminderType,
            principal.actorId,
            input.cadenceDays ?? null,
            input.nextRunAt,
            input.graceMinutes,
            input.stopOnCompletion ? 1 : 0,
            principal.actorId,
            now,
            now,
          ),
        this.audit(
          "REMINDER_RULE_CREATED",
          principal,
          "reminder_rule",
          id,
          requestId,
          now,
        ),
      ]);
    } catch {
      throw new MemberError("REMINDER_CONFLICT", 409, "reminder_conflict");
    }
    return this.overview(principal, memberId);
  }

  async updateReminder(
    principal: Principal,
    memberId: string,
    ruleId: string,
    input: z.infer<typeof reminderUpdateInput>,
    requestId: string,
  ) {
    const unitId = await this.unit(principal, memberId, true);
    const now = new Date().toISOString();
    const results = await this.db.batch([
      this.db
        .prepare(
          `UPDATE reminder_rules SET next_run_at=?,cadence_days=?,grace_minutes=?,enabled=?,stop_on_completion=?,version=version+1,updated_at=?
           WHERE id=? AND member_id=? AND unit_id=? AND recipient_user_id=? AND version=?`,
        )
        .bind(
          input.nextRunAt,
          input.cadenceDays ?? null,
          input.graceMinutes,
          input.enabled ? 1 : 0,
          input.stopOnCompletion ? 1 : 0,
          now,
          ruleId,
          memberId,
          unitId,
          principal.actorId,
          input.version,
        ),
      this.audit(
        "REMINDER_RULE_UPDATED",
        principal,
        "reminder_rule",
        ruleId,
        requestId,
        now,
        true,
      ),
    ]);
    if ((results[0]?.meta?.changes ?? 0) !== 1)
      throw new MemberError("VERSION_CONFLICT", 409, "version_conflict");
    return this.overview(principal, memberId);
  }

  async materializeDue(principal: Principal, now: string, requestId: string) {
    const rules = await this.db
      .prepare(
        `SELECT * FROM reminder_rules
         WHERE recipient_user_id=? AND enabled=1
           AND datetime(next_run_at, '+' || grace_minutes || ' minutes')<=datetime(?)
         ORDER BY next_run_at LIMIT 100`,
      )
      .bind(principal.actorId, now)
      .all<{
        id: string;
        member_id: string;
        unit_id: string;
        subject_type: string;
        subject_id: string;
        reminder_type: string;
        next_run_at: string;
        cadence_days: number | null;
        stop_on_completion: number;
        version: number;
      }>();
    let created = 0;
    for (const rule of rules.results) {
      if (
        !principal.globalUnitRead &&
        !principal.unitScopes.some((scope) => scope.unitId === rule.unit_id)
      )
        continue;
      const completed = await this.db
        .prepare(
          `SELECT CASE
             WHEN ?='GOAL' THEN EXISTS(SELECT 1 FROM goals WHERE id=? AND lifecycle_status IN ('ABANDONED','ARCHIVED'))
             WHEN ?='ACTION' THEN EXISTS(SELECT 1 FROM action_items WHERE id=? AND status IN ('DONE','CANCELLED'))
             WHEN ?='ONE_ON_ONE' THEN EXISTS(SELECT 1 FROM one_on_ones WHERE id=? AND status IN ('HELD','CANCELLED'))
             ELSE 0 END AS completed`,
        )
        .bind(
          rule.subject_type,
          rule.subject_id,
          rule.subject_type,
          rule.subject_id,
          rule.subject_type,
          rule.subject_id,
        )
        .first<{ completed: number }>();
      if (rule.stop_on_completion && completed?.completed) {
        await this.db
          .prepare(
            "UPDATE reminder_rules SET enabled=0,version=version+1,updated_at=? WHERE id=? AND version=?",
          )
          .bind(now, rule.id, rule.version)
          .run();
        continue;
      }
      const tokyoDay = new Date(
        new Date(rule.next_run_at).getTime() + 9 * 3_600_000,
      )
        .toISOString()
        .slice(0, 10);
      const dedupeKey = `${principal.actorId}:${rule.member_id}:${tokyoDay}`;
      const notificationId = await deterministicUuid(
        `notification:${dedupeKey}`,
      );
      let next = rule.next_run_at;
      if (rule.cadence_days)
        do {
          next = new Date(
            new Date(next).getTime() + rule.cadence_days * 86_400_000,
          ).toISOString();
        } while (new Date(next).getTime() <= new Date(now).getTime());
      const results = await this.db.batch([
        this.db
          .prepare(
            `INSERT OR IGNORE INTO notifications VALUES(?,?,?,?,?,?,?,?,?,NULL,?,?)`,
          )
          .bind(
            notificationId,
            principal.actorId,
            rule.member_id,
            rule.unit_id,
            "GROUPED_SUPPORT_REMINDER",
            "MEMBER",
            rule.member_id,
            rule.next_run_at,
            "PENDING",
            dedupeKey,
            now,
          ),
        this.db
          .prepare(
            `INSERT OR IGNORE INTO jobs VALUES(?,'NOTIFICATION_OUTBOX',?,'PENDING',?,0,?,NULL,NULL,?,?)`,
          )
          .bind(`job:${dedupeKey}`, notificationId, dedupeKey, now, now, now),
        this.db
          .prepare(
            "INSERT OR IGNORE INTO notification_items VALUES(?,?,?,?,?,?,?)",
          )
          .bind(
            `item:${rule.id}:${rule.next_run_at}`,
            notificationId,
            rule.id,
            rule.reminder_type,
            rule.subject_type,
            rule.subject_id,
            now,
          ),
        this.db
          .prepare(
            `UPDATE reminder_rules SET next_run_at=?,enabled=?,version=version+1,updated_at=?
             WHERE id=? AND version=?`,
          )
          .bind(next, rule.cadence_days ? 1 : 0, now, rule.id, rule.version),
        this.audit(
          "REMINDER_MATERIALIZED",
          principal,
          "reminder_rule",
          rule.id,
          requestId,
          now,
          true,
        ),
      ]);
      if ((results[0]?.meta?.changes ?? 0) === 1) created += 1;
    }
    await this.dispatchFake(principal, now, requestId);
    return { created, notifications: await this.notifications(principal) };
  }

  private async dispatchFake(
    principal: Principal,
    now: string,
    requestId: string,
  ) {
    const settings = await this.db
      .prepare(
        "SELECT maintenance_mode,mail_incident_disabled FROM operational_settings WHERE id='global'",
      )
      .bind()
      .first<{ maintenance_mode: number; mail_incident_disabled: number }>();
    if (settings?.maintenance_mode || settings?.mail_incident_disabled) return;
    const jobs = await this.db
      .prepare(
        `SELECT j.id,j.payload_ref FROM jobs j JOIN notifications n ON n.id=j.payload_ref
         WHERE j.status='PENDING' AND n.recipient_user_id=? ORDER BY j.created_at LIMIT 100`,
      )
      .bind(principal.actorId)
      .all<{ id: string; payload_ref: string }>();
    for (const job of jobs.results)
      await this.db.batch([
        this.db
          .prepare(
            "UPDATE notifications SET status='DELIVERED_FAKE' WHERE id=? AND status='PENDING'",
          )
          .bind(job.payload_ref),
        this.db
          .prepare(
            "UPDATE jobs SET status='SUCCEEDED',attempts=attempts+1,updated_at=? WHERE id=? AND status='PENDING'",
          )
          .bind(now, job.id),
        this.audit(
          "NOTIFICATION_DISPATCHED_FAKE",
          principal,
          "notification",
          job.payload_ref,
          requestId,
          now,
          true,
        ),
      ]);
  }

  async notifications(principal: Principal) {
    const result = await this.db
      .prepare(
        `SELECT id,member_id,unit_id,type,subject_type,subject_id,scheduled_at,status,read_at
         FROM notifications WHERE recipient_user_id=? ORDER BY scheduled_at DESC LIMIT 100`,
      )
      .bind(principal.actorId)
      .all();
    const notifications = [];
    for (const notification of result.results as { id: string }[]) {
      const items = await this.db
        .prepare(
          "SELECT type,subject_type,subject_id FROM notification_items WHERE notification_id=? ORDER BY type,subject_id",
        )
        .bind(notification.id)
        .all();
      notifications.push({ ...notification, items: items.results });
    }
    return notifications;
  }

  async markNotificationRead(
    principal: Principal,
    notificationId: string,
    requestId: string,
  ) {
    const now = new Date().toISOString();
    const results = await this.db.batch([
      this.db
        .prepare(
          "UPDATE notifications SET status='READ',read_at=? WHERE id=? AND recipient_user_id=?",
        )
        .bind(now, notificationId, principal.actorId),
      this.audit(
        "NOTIFICATION_READ",
        principal,
        "notification",
        notificationId,
        requestId,
        now,
        true,
      ),
    ]);
    if ((results[0]?.meta?.changes ?? 0) !== 1)
      throw new MemberError(
        "RESOURCE_NOT_FOUND",
        404,
        "notification_not_visible",
      );
    return this.notifications(principal);
  }
}
