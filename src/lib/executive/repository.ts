import { repositoryUnitScope } from "../auth/policy";
import type { Principal } from "../auth/types";
import { MemberError } from "../member/errors";
import type { z } from "zod";
import {
  calculateTurnover,
  classifyResponseWindow,
  secondBusinessDayOfFollowingMonth,
  TURNOVER_RULE_VERSION,
} from "./calculations";
import type {
  holidayCalendarInput,
  policyDocumentInput,
  policyVersionInput,
  reviewCommentInput,
  reviewInput,
  turnoverInput,
} from "./schemas";

type DB = Pick<D1Database, "prepare" | "batch">;
type Row = Record<string, unknown>;

const reviewTargetVisibleSql =
  "((r.target_type='GOAL_VERSION' AND EXISTS (SELECT 1 FROM goal_versions v JOIN goals g ON g.id=v.goal_id WHERE v.id=r.target_id AND g.unit_id=r.unit_id AND v.version_no=r.revision_no AND v.confidentiality='NORMAL' AND v.visibility='UL_AND_EXEC')) OR " +
  "(r.target_type='PROGRESS_ENTRY' AND EXISTS (SELECT 1 FROM progress_entries p JOIN goal_versions v ON v.id=p.goal_version_id WHERE p.id=r.target_id AND p.unit_id=r.unit_id AND v.version_no=r.revision_no AND p.confidentiality='NORMAL')) OR " +
  "(r.target_type='REFLECTION' AND EXISTS (SELECT 1 FROM reflections f JOIN goal_versions v ON v.id=f.goal_version_id WHERE f.id=r.target_id AND f.unit_id=r.unit_id AND v.version_no=r.revision_no AND f.confidentiality='NORMAL')) OR " +
  "(r.target_type='ONE_ON_ONE_ENTRY' AND EXISTS (SELECT 1 FROM one_on_one_entries e JOIN one_on_ones o ON o.id=e.one_on_one_id LEFT JOIN goal_versions v ON v.id=e.goal_version_id WHERE e.id=r.target_id AND o.unit_id=r.unit_id AND COALESCE(v.version_no,o.version)=r.revision_no AND e.confidentiality='NORMAL' AND e.entry_type<>'RAW_NOTE')))";

const reviewTargetSummarySql =
  "CASE r.target_type " +
  "WHEN 'GOAL_VERSION' THEN (SELECT v.title || CASE WHEN v.description='' THEN '' ELSE ': ' || v.description END FROM goal_versions v WHERE v.id=r.target_id) " +
  "WHEN 'PROGRESS_ENTRY' THEN (SELECT p.note FROM progress_entries p WHERE p.id=r.target_id) " +
  "WHEN 'REFLECTION' THEN (SELECT f.outcome FROM reflections f WHERE f.id=r.target_id) " +
  "WHEN 'ONE_ON_ONE_ENTRY' THEN (SELECT e.body FROM one_on_one_entries e WHERE e.id=r.target_id) END target_summary";

export class ExecutiveRepository {
  constructor(private db: DB) {}

  private audit(
    type: string,
    principal: Principal,
    targetType: string,
    targetId: string,
    requestId: string,
    now: string,
    conditional = false,
  ) {
    const sql = conditional
      ? "INSERT INTO audit_events(id,event_type,occurred_at,actor_id,target_type,target_id,outcome,reason,request_id,metadata_json) SELECT ?,?,?,?,?,?,'SUCCEEDED','operation_succeeded',?,'{}' WHERE changes()=1"
      : "INSERT INTO audit_events(id,event_type,occurred_at,actor_id,target_type,target_id,outcome,reason,request_id,metadata_json) VALUES(?,?,?,?,?,?,'SUCCEEDED','operation_succeeded',?,'{}')";
    return this.db
      .prepare(sql)
      .bind(
        crypto.randomUUID(),
        type,
        now,
        principal.actorId,
        targetType,
        targetId,
        requestId,
      );
  }

  async overview(principal: Principal) {
    if (!principal.globalUnitRead)
      throw new MemberError(
        "RESOURCE_NOT_FOUND",
        404,
        "executive_overview_not_visible",
      );
    const [units, reviews, turnover] = await Promise.all([
      this.db
        .prepare(
          "SELECT u.id,u.code,u.name,u.status," +
            "(SELECT COUNT(*) FROM member_unit_history h JOIN members m ON m.id=h.member_id " +
            "WHERE h.unit_id=u.id AND h.is_primary=1 AND h.started_on<=date('now') " +
            "AND (h.ended_on IS NULL OR h.ended_on>date('now')) AND m.status<>'LEFT') member_count," +
            "(SELECT COUNT(*) FROM review_requests r WHERE r.unit_id=u.id AND r.status<>'CONFIRMED') open_reviews " +
            "FROM units u WHERE u.status='ACTIVE' ORDER BY u.code",
        )
        .all<Row>(),
      this.db
        .prepare(
          "SELECT status,COUNT(*) count FROM review_requests GROUP BY status ORDER BY status",
        )
        .all<Row>(),
      this.db
        .prepare(
          "SELECT t.* FROM turnover_calculations t " +
            "WHERE NOT EXISTS (SELECT 1 FROM turnover_calculations newer WHERE newer.unit_id=t.unit_id AND newer.calculated_at>t.calculated_at) " +
            "ORDER BY t.unit_id",
        )
        .all<Row>(),
    ]);
    return {
      units: units.results,
      reviewCounts: reviews.results,
      latestTurnover: turnover.results,
      disclaimer: "参考情報であり正式評価ではありません",
      prohibitedUses: [
        "人の順位付け",
        "離職予測",
        "意欲・心理状態の推定",
        "人事評価・給与の確定",
      ],
    };
  }

  async listPolicies() {
    const docs = await this.db
      .prepare(
        "SELECT d.*,COUNT(DISTINCT v.id) version_count,COUNT(DISTINCT l.id) historic_link_count " +
          "FROM policy_documents d LEFT JOIN policy_versions v ON v.document_id=d.id " +
          "LEFT JOIN policy_items i ON i.policy_version_id=v.id LEFT JOIN goal_policy_links l ON l.policy_item_id=i.id " +
          "GROUP BY d.id ORDER BY d.type,d.created_at",
      )
      .all<Row>();
    const versions = await this.db
      .prepare(
        "SELECT v.*,d.type,d.source_name," +
          "(SELECT COUNT(*) FROM goal_policy_links l JOIN policy_items i ON i.id=l.policy_item_id WHERE i.policy_version_id=v.id) historic_link_count " +
          "FROM policy_versions v JOIN policy_documents d ON d.id=v.document_id ORDER BY d.type,v.effective_from DESC,v.version_no DESC",
      )
      .all<Row>();
    const [items, calendars] = await Promise.all([
      this.db
        .prepare(
          "SELECT i.* FROM policy_items i JOIN policy_versions v ON v.id=i.policy_version_id " +
            "ORDER BY v.document_id,v.version_no,i.category,i.code",
        )
        .all<Row>(),
      this.db
        .prepare(
          "SELECT c.*,COUNT(h.id) holiday_count FROM holiday_calendars c LEFT JOIN holidays h ON h.calendar_id=c.id " +
            "GROUP BY c.id ORDER BY c.year DESC,c.version_no DESC",
        )
        .all<Row>(),
    ]);
    return {
      documents: docs.results,
      versions: versions.results,
      items: items.results,
      holidayCalendars: calendars.results,
      managementNotice:
        "Management項目はDRAFTであり、正式評価・通常AI Context・目標linkには使用しません",
    };
  }

  async createHolidayCalendar(
    principal: Principal,
    input: z.infer<typeof holidayCalendarInput>,
    requestId: string,
  ) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    try {
      await this.db.batch([
        this.db
          .prepare(
            "INSERT INTO holiday_calendars(id,year,version_no,status,checksum,created_by,created_at) VALUES(?,?,?,'DRAFT',?,?,?)",
          )
          .bind(
            id,
            input.year,
            input.versionNo,
            input.checksum,
            principal.actorId,
            now,
          ),
        ...input.holidays.map((holiday) =>
          this.db
            .prepare(
              "INSERT INTO holidays(id,calendar_id,holiday_date,name) VALUES(?,?,?,?)",
            )
            .bind(crypto.randomUUID(), id, holiday.date, holiday.name),
        ),
        this.db
          .prepare(
            "UPDATE holiday_calendars SET status=? WHERE id=? AND status='DRAFT'",
          )
          .bind(input.status, id),
        this.audit(
          "HOLIDAY_CALENDAR_REGISTERED",
          principal,
          "holiday_calendar",
          id,
          requestId,
          now,
          true,
        ),
      ]);
    } catch {
      throw new MemberError(
        "VERSION_CONFLICT",
        409,
        "holiday_calendar_conflict",
      );
    }
    return this.listPolicies();
  }

  async createPolicyDocument(
    principal: Principal,
    input: z.infer<typeof policyDocumentInput>,
    requestId: string,
  ) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await this.db.batch([
      this.db
        .prepare(
          "INSERT INTO policy_documents(id,type,source_name,source_ref,owner,status,version,created_by,created_at,updated_at) VALUES(?,?,?,?,?,'ACTIVE',1,?,?,?)",
        )
        .bind(
          id,
          input.type,
          input.sourceName,
          input.sourceRef,
          input.owner,
          principal.actorId,
          now,
          now,
        ),
      this.audit(
        "POLICY_DOCUMENT_CREATED",
        principal,
        "policy_document",
        id,
        requestId,
        now,
      ),
    ]);
    return this.listPolicies();
  }

  async addPolicyVersion(
    principal: Principal,
    documentId: string,
    input: z.infer<typeof policyVersionInput>,
    requestId: string,
  ) {
    const versionId = crypto.randomUUID();
    const now = new Date().toISOString();
    const statements = [
      this.db
        .prepare(
          "UPDATE policy_documents SET version=version+1,updated_at=? WHERE id=? AND version=?",
        )
        .bind(now, documentId, input.documentVersion),
      this.db
        .prepare(
          "INSERT INTO policy_versions(id,document_id,version_no,effective_from,effective_to,status,imported_by,checksum,created_at) " +
            "SELECT ?,id,?,?,?,?,?,?,? FROM policy_documents WHERE id=? AND version=?",
        )
        .bind(
          versionId,
          input.versionNo,
          input.effectiveFrom,
          input.effectiveTo ?? null,
          input.status,
          principal.actorId,
          input.checksum,
          now,
          documentId,
          input.documentVersion + 1,
        ),
      ...input.items.map((item) =>
        this.db
          .prepare(
            "INSERT INTO policy_items(id,policy_version_id,category,code,title,description,criteria_json,draft,created_at) VALUES(?,?,?,?,?,?,?,?,?)",
          )
          .bind(
            crypto.randomUUID(),
            versionId,
            item.category,
            item.code,
            item.title,
            item.description,
            JSON.stringify(item.criteria),
            item.category === "Management" ? 1 : 0,
            now,
          ),
      ),
      this.audit(
        "POLICY_VERSION_REGISTERED",
        principal,
        "policy_version",
        versionId,
        requestId,
        now,
      ),
    ];
    try {
      const result = await this.db.batch(statements);
      if (!result[0]?.meta.changes) throw new Error("version_conflict");
    } catch {
      throw new MemberError("VERSION_CONFLICT", 409, "policy_version_conflict");
    }
    return this.listPolicies();
  }

  async linkGoalPolicy(
    principal: Principal,
    goalVersionId: string,
    policyItemId: string,
    relevanceNote: string,
    requestId: string,
  ) {
    const scope = repositoryUnitScope(principal);
    const placeholders = scope.unitIds.map(() => "?").join(",");
    const globalWrite = principal.roles.includes("SYSTEM_ADMIN");
    if (!globalWrite && !scope.unitIds.length)
      throw new MemberError("RESOURCE_NOT_FOUND", 404, "goal_not_visible");
    const predicate = globalWrite
      ? ""
      : " AND g.unit_id IN (" + placeholders + ")";
    const goal = await this.db
      .prepare(
        "SELECT gv.id FROM goal_versions gv JOIN goals g ON g.id=gv.goal_id " +
          "WHERE gv.id=? AND g.current_version_id=gv.id" +
          predicate,
      )
      .bind(goalVersionId, ...scope.unitIds)
      .first();
    if (!goal)
      throw new MemberError("RESOURCE_NOT_FOUND", 404, "goal_not_visible");
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    try {
      await this.db.batch([
        this.db
          .prepare(
            "INSERT INTO goal_policy_links(id,goal_version_id,policy_item_id,relevance_note,linked_by,created_at) VALUES(?,?,?,?,?,?)",
          )
          .bind(
            id,
            goalVersionId,
            policyItemId,
            relevanceNote,
            principal.actorId,
            now,
          ),
        this.audit(
          "GOAL_POLICY_LINKED",
          principal,
          "goal_version",
          goalVersionId,
          requestId,
          now,
        ),
      ]);
    } catch {
      throw new MemberError(
        "INVALID_STATE_TRANSITION",
        422,
        "policy_link_not_eligible",
      );
    }
    return { id, goalVersionId, policyItemId, relevanceNote };
  }

  async listReviews(principal: Principal) {
    const scope = repositoryUnitScope(principal);
    if (!scope.global && !scope.unitIds.length) return [];
    const scopePredicate = scope.global
      ? ""
      : "r.unit_id IN (" + scope.unitIds.map(() => "?").join(",") + ") AND ";
    const rows = await this.db
      .prepare(
        "SELECT r.*,u.code unit_code,u.name unit_name," +
          reviewTargetSummarySql +
          " FROM review_requests r JOIN units u ON u.id=r.unit_id WHERE " +
          scopePredicate +
          reviewTargetVisibleSql +
          " ORDER BY CASE r.status WHEN 'RETURNED' THEN 0 WHEN 'UL_RESPONDED' THEN 1 WHEN 'UNCONFIRMED' THEN 2 ELSE 3 END,r.updated_at DESC",
      )
      .bind(...scope.unitIds)
      .all<Row>();
    const result = [];
    for (const row of rows.results) {
      const comments = await this.db
        .prepare(
          "SELECT id,author_id,body,visibility,disposition,created_at FROM review_comments WHERE review_request_id=? ORDER BY created_at",
        )
        .bind(row.id)
        .all<Row>();
      result.push({ ...row, comments: comments.results });
    }
    return result;
  }

  async createReview(
    principal: Principal,
    input: z.infer<typeof reviewInput>,
    requestId: string,
  ) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    try {
      await this.db.batch([
        this.db
          .prepare(
            "INSERT INTO review_requests(id,target_type,target_id,unit_id,requested_by,assigned_to,status,revision_no,version,created_at,updated_at) " +
              "VALUES(?,?,?,?,?,?,'UNCONFIRMED',?,1,?,?)",
          )
          .bind(
            id,
            input.targetType,
            input.targetId,
            input.unitId,
            principal.actorId,
            input.assignedTo ?? null,
            input.revisionNo,
            now,
            now,
          ),
        this.audit("REVIEW_REQUESTED", principal, "review", id, requestId, now),
      ]);
    } catch {
      throw new MemberError(
        "RESOURCE_NOT_FOUND",
        404,
        "review_target_not_visible",
      );
    }
    return this.listReviews(principal);
  }

  async reviewUnit(reviewId: string) {
    const row = await this.db
      .prepare(
        "SELECT r.unit_id,r.status,r.version FROM review_requests r WHERE r.id=? AND " +
          reviewTargetVisibleSql,
      )
      .bind(reviewId)
      .first<{ unit_id: string; status: string; version: number }>();
    if (!row)
      throw new MemberError("RESOURCE_NOT_FOUND", 404, "review_not_visible");
    return row;
  }

  async addReviewComment(
    principal: Principal,
    reviewId: string,
    input: z.infer<typeof reviewCommentInput>,
    requestId: string,
  ) {
    const current = await this.reviewUnit(reviewId);
    const nextStatus: Record<string, string> = {
      COMMENT: "COMMENTING",
      RETURN: "RETURNED",
      CONFIRM: "CONFIRMED",
      UL_RESPONSE: "UL_RESPONDED",
    };
    const allowed: Record<string, string[]> = {
      UNCONFIRMED: ["COMMENT", "RETURN", "CONFIRM"],
      COMMENTING: ["COMMENT", "RETURN", "CONFIRM"],
      RETURNED: ["UL_RESPONSE"],
      UL_RESPONDED: ["COMMENT", "RETURN", "CONFIRM"],
      CONFIRMED: [],
    };
    if (!allowed[current.status]?.includes(input.disposition))
      throw new MemberError(
        "INVALID_STATE_TRANSITION",
        422,
        "invalid_review_transition",
      );
    const now = new Date().toISOString();
    const commentId = crypto.randomUUID();
    const result = await this.db.batch([
      this.db
        .prepare(
          "INSERT INTO review_comments(id,review_request_id,author_id,body,visibility,disposition,created_at) " +
            "SELECT ?,id,? ,?,'EXEC_AND_UL',?,? FROM review_requests WHERE id=? AND version=?",
        )
        .bind(
          commentId,
          principal.actorId,
          input.body,
          input.disposition,
          now,
          reviewId,
          input.version,
        ),
      this.db
        .prepare(
          "UPDATE review_requests SET status=?,version=version+1,updated_at=? WHERE id=? AND version=?",
        )
        .bind(nextStatus[input.disposition], now, reviewId, input.version),
      this.audit(
        "REVIEW_ACTION_RECORDED",
        principal,
        "review",
        reviewId,
        requestId,
        now,
        true,
      ),
    ]);
    if (!result[1]?.meta.changes)
      throw new MemberError("VERSION_CONFLICT", 409, "review_version_conflict");
    return this.listReviews(principal);
  }

  async calculateTurnoverForUnit(
    principal: Principal,
    unitId: string,
    input: z.infer<typeof turnoverInput>,
    requestId: string,
  ) {
    const scope = repositoryUnitScope(principal);
    if (!scope.global && !scope.unitIds.includes(unitId))
      throw new MemberError("RESOURCE_NOT_FOUND", 404, "unit_not_visible");
    const countAt = async (on: string) => {
      const row = await this.db
        .prepare(
          "SELECT COUNT(DISTINCT h.member_id) count FROM member_unit_history h " +
            "JOIN member_status_history s ON s.member_id=h.member_id " +
            "AND s.started_on<=? AND (s.ended_on IS NULL OR s.ended_on>?) " +
            "WHERE h.unit_id=? AND h.is_primary=1 AND h.started_on<=? " +
            "AND (h.ended_on IS NULL OR h.ended_on>?) AND s.status='ACTIVE'",
        )
        .bind(on, on, unitId, on, on)
        .first<{ count: number }>();
      return Number(row?.count ?? 0);
    };
    const [startCount, endCount, leavers] = await Promise.all([
      countAt(input.periodStart),
      countAt(input.periodEnd),
      this.db
        .prepare(
          "SELECT COUNT(*) count FROM member_status_history s " +
            "JOIN member_unit_history h ON h.member_id=s.member_id AND h.is_primary=1 " +
            "AND h.started_on<=s.started_on AND (h.ended_on IS NULL OR h.ended_on>=s.started_on) " +
            "WHERE s.status='LEFT' AND s.started_on>=? AND s.started_on<=? AND h.unit_id=?",
        )
        .bind(input.periodStart, input.periodEnd, unitId)
        .first<{ count: number }>(),
    ]);
    const calculation = calculateTurnover(
      startCount,
      endCount,
      Number(leavers?.count ?? 0),
    );
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const result = await this.db.batch([
      this.db
        .prepare(
          "INSERT OR IGNORE INTO turnover_calculations(id,unit_id,period_start,period_end,start_count,end_count,leaver_count,average_count,raw_rate,display_rate,calculable,is_eight_or_more,rule_version,calculated_by,calculated_at) " +
            "VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        )
        .bind(
          id,
          unitId,
          input.periodStart,
          input.periodEnd,
          calculation.startCount,
          calculation.endCount,
          calculation.leaverCount,
          calculation.averageCount,
          calculation.rawRate,
          calculation.displayRate,
          calculation.calculable ? 1 : 0,
          calculation.isEightOrMore ? 1 : 0,
          TURNOVER_RULE_VERSION,
          principal.actorId,
          now,
        ),
      this.audit(
        "TURNOVER_CALCULATED",
        principal,
        "unit",
        unitId,
        requestId,
        now,
        true,
      ),
    ]);
    const saved = await this.db
      .prepare(
        "SELECT * FROM turnover_calculations WHERE unit_id=? AND period_start=? AND period_end=? AND rule_version=?",
      )
      .bind(unitId, input.periodStart, input.periodEnd, TURNOVER_RULE_VERSION)
      .first<Row>();
    return {
      ...saved,
      created: Boolean(result[0]?.meta.changes),
      disclaimer: calculation.disclaimer,
    };
  }

  async calculateBusinessDay(targetMonth: string) {
    const [year, month] = targetMonth.split("-").map(Number);
    const dueYear = month === 12 ? year! + 1 : year!;
    const calendar = await this.db
      .prepare(
        "SELECT id,version_no FROM holiday_calendars WHERE year=? AND status='ACTIVE'",
      )
      .bind(dueYear)
      .first<{ id: string; version_no: string }>();
    if (!calendar)
      throw new MemberError(
        "CALENDAR_NOT_CONFIGURED",
        422,
        "active_holiday_calendar_required",
      );
    const holidayRows = await this.db
      .prepare(
        "SELECT holiday_date FROM holidays WHERE calendar_id=? ORDER BY holiday_date",
      )
      .bind(calendar.id)
      .all<{ holiday_date: string }>();
    return {
      targetMonth,
      dueDate: secondBusinessDayOfFollowingMonth(
        targetMonth,
        new Set(holidayRows.results.map((row) => row.holiday_date)),
      ),
      calendarVersion: calendar.version_no,
      source: "VERSIONED_JP_HOLIDAY_CALENDAR",
      disclaimer: "決定論的な参考計算です。AIは使用していません",
    };
  }

  calculateResponseWindow(
    contactAt: string,
    responseAt: string | null,
    referenceAt: string,
  ) {
    return classifyResponseWindow(contactAt, responseAt, referenceAt);
  }
}
