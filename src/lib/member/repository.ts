import type { Principal } from "../auth/types";
import { repositoryUnitScope } from "../auth/policy";
import { MemberError } from "./errors";
import type {
  MemberDetail,
  MemberStatus,
  MemberSummary,
  Page,
  StatusHistory,
  UnitHistory,
  UnitSummary,
} from "./types";

type DB = Pick<D1Database, "prepare" | "batch">;
const placeholders = (n: number) =>
  Array.from({ length: n }, () => "?").join(",");
function scope(principal: Principal, write = false) {
  const value = repositoryUnitScope(principal);
  return {
    global:
      (!write && value.global) ||
      (write && principal.roles.includes("SYSTEM_ADMIN")),
    ids: value.unitIds,
  };
}
export class D1MemberRepository {
  constructor(private readonly db: DB) {}
  async listUnits(principal: Principal): Promise<UnitSummary[]> {
    const s = scope(principal);
    if (!s.global && !s.ids.length) return [];
    const where = s.global ? "" : `AND u.id IN (${placeholders(s.ids.length)})`;
    const rows = await this.db
      .prepare(
        `SELECT u.id,u.code,u.name,u.status,u.version FROM units u WHERE u.status='ACTIVE' ${where} ORDER BY u.code`,
      )
      .bind(...s.ids)
      .all<Record<string, unknown>>();
    return rows.results.map((r) => ({
      id: String(r.id),
      code: String(r.code),
      name: String(r.name),
      status: String(r.status),
      version: Number(r.version),
    }));
  }
  async unitVisible(
    principal: Principal,
    unitId: string,
    write = false,
  ): Promise<boolean> {
    const s = scope(principal, write);
    if (!s.global && !s.ids.includes(unitId)) return false;
    const row = await this.db
      .prepare("SELECT id FROM units WHERE id=? AND status='ACTIVE'")
      .bind(unitId)
      .first();
    return !!row;
  }
  async listMembers(
    principal: Principal,
    unitId: string,
    cursor: string | undefined,
    limit: number,
  ): Promise<Page<MemberSummary>> {
    if (!(await this.unitVisible(principal, unitId)))
      throw new MemberError("RESOURCE_NOT_FOUND", 404, "unit_not_visible");
    const rows = await this.db
      .prepare(
        `SELECT m.id,m.display_name,m.status,m.version,m.updated_at,h.unit_id FROM members m JOIN member_unit_history h ON h.member_id=m.id AND h.is_primary=1 AND h.started_on<=date('now') AND (h.ended_on IS NULL OR h.ended_on>date('now')) WHERE h.unit_id=? AND (? IS NULL OR m.id>?) ORDER BY m.id LIMIT ?`,
      )
      .bind(unitId, cursor ?? null, cursor ?? null, limit + 1)
      .all<Record<string, unknown>>();
    const mapped = rows.results.slice(0, limit).map(memberSummary);
    return {
      items: mapped,
      nextCursor: rows.results.length > limit ? mapped.at(-1)!.id : null,
    };
  }
  async findMember(
    principal: Principal,
    id: string,
    write = false,
  ): Promise<MemberDetail | null> {
    const s = scope(principal, write);
    if (!s.global && !s.ids.length) return null;
    const pred = s.global
      ? ""
      : `AND h.unit_id IN (${placeholders(s.ids.length)})`;
    const row = await this.db
      .prepare(
        `SELECT m.id,m.employee_ref,m.display_name,m.status,m.joined_on,m.left_on,m.version,m.updated_at,h.unit_id FROM members m JOIN member_unit_history h ON h.member_id=m.id AND h.is_primary=1 AND h.started_on<=date('now') AND (h.ended_on IS NULL OR h.ended_on>date('now')) WHERE m.id=? ${pred}`,
      )
      .bind(id, ...s.ids)
      .first<Record<string, unknown>>();
    if (!row) return null;
    const [uh, sh] = await Promise.all([
      this.db
        .prepare(
          "SELECT id,unit_id,is_primary,started_on,ended_on,source FROM member_unit_history WHERE member_id=? ORDER BY started_on DESC",
        )
        .bind(id)
        .all<Record<string, unknown>>(),
      this.db
        .prepare(
          "SELECT id,status,started_on,ended_on,reason_code FROM member_status_history WHERE member_id=? ORDER BY started_on DESC",
        )
        .bind(id)
        .all<Record<string, unknown>>(),
    ]);
    return {
      ...memberSummary(row),
      employeeRef: String(row.employee_ref),
      joinedOn: String(row.joined_on),
      leftOn: row.left_on ? String(row.left_on) : null,
      unitHistories: uh.results.map(unitHistory),
      statusHistories: sh.results.map(statusHistory),
    };
  }
  async createMember(
    principal: Principal,
    input: {
      employeeRef: string;
      displayName: string;
      joinedOn: string;
      primaryUnitStartedOn: string;
    },
    unitId: string,
    now: string,
  ): Promise<MemberDetail> {
    if (!(await this.unitVisible(principal, unitId, true)))
      throw new MemberError("RESOURCE_NOT_FOUND", 404, "unit_not_visible");
    const id = crypto.randomUUID(),
      uh = crypto.randomUUID(),
      sh = crypto.randomUUID();
    try {
      await this.db.batch([
        this.db
          .prepare(
            `INSERT INTO members(id,employee_ref,display_name,status,joined_on,version,created_at,updated_at) VALUES(?,?,?,'ACTIVE',?,1,?,?)`,
          )
          .bind(
            id,
            input.employeeRef,
            input.displayName,
            input.joinedOn,
            now,
            now,
          ),
        this.db
          .prepare(
            `INSERT INTO member_unit_history(id,member_id,unit_id,is_primary,started_on,source,decided_by,created_at) VALUES(?,?,?,1,?,'MANUAL',?,?)`,
          )
          .bind(
            uh,
            id,
            unitId,
            input.primaryUnitStartedOn,
            principal.actorId,
            now,
          ),
        this.db
          .prepare(
            `INSERT INTO member_status_history(id,member_id,status,started_on,reason_code,decided_by,created_at) VALUES(?,?,'ACTIVE',?,'JOINED',?,?)`,
          )
          .bind(sh, id, input.joinedOn, principal.actorId, now),
      ]);
    } catch {
      throw new MemberError("DATA_CONFLICT", 409, "history_conflict");
    }
    return (await this.findMember(principal, id, true))!;
  }
  async updateMember(
    principal: Principal,
    id: string,
    input: { displayName?: string; employeeRef?: string; version: number },
    now: string,
  ): Promise<MemberDetail> {
    if (!(await this.findMember(principal, id, true)))
      throw new MemberError("RESOURCE_NOT_FOUND", 404, "member_not_visible");
    const result = await this.db
      .prepare(
        `UPDATE members SET display_name=COALESCE(?,display_name),employee_ref=COALESCE(?,employee_ref),version=version+1,updated_at=? WHERE id=? AND version=?`,
      )
      .bind(
        input.displayName ?? null,
        input.employeeRef ?? null,
        now,
        id,
        input.version,
      )
      .run();
    if (!result.meta.changes)
      throw new MemberError("VERSION_CONFLICT", 409, "version_conflict");
    return (await this.findMember(principal, id, true))!;
  }
  async addUnitHistory(
    principal: Principal,
    id: string,
    input: {
      unitId: string;
      isPrimary: boolean;
      startedOn: string;
      endedOn?: string | null;
      source: string;
      version: number;
    },
    now: string,
  ): Promise<MemberDetail> {
    if (
      !(await this.findMember(principal, id, true)) ||
      !(await this.unitVisible(principal, input.unitId, true))
    )
      throw new MemberError("RESOURCE_NOT_FOUND", 404, "member_not_visible");
    const historyId = crypto.randomUUID();
    let results: D1Result<unknown>[];
    try {
      results = await this.db.batch([
        this.db
          .prepare(
            `INSERT INTO member_unit_history(id,member_id,unit_id,is_primary,started_on,ended_on,source,decided_by,created_at)
             SELECT ?,m.id,?,?,?,?,?,?,? FROM members m WHERE m.id=? AND m.version=?`,
          )
          .bind(
            historyId,
            input.unitId,
            input.isPrimary ? 1 : 0,
            input.startedOn,
            input.endedOn ?? null,
            input.source,
            principal.actorId,
            now,
            id,
            input.version,
          ),
        this.db
          .prepare(
            `UPDATE member_unit_history SET ended_on=?
             WHERE member_id=? AND is_primary=1 AND ended_on IS NULL
               AND started_on<? AND id<>? AND ?=1
               AND EXISTS (SELECT 1 FROM member_unit_history WHERE id=?)`,
          )
          .bind(
            input.startedOn,
            id,
            input.startedOn,
            historyId,
            input.isPrimary ? 1 : 0,
            historyId,
          ),
        this.db
          .prepare(
            `UPDATE members SET version=version+1,updated_at=?
             WHERE id=? AND EXISTS (SELECT 1 FROM member_unit_history WHERE id=?)`,
          )
          .bind(now, id, historyId),
      ]);
    } catch {
      // D1 batch is transactional: any statement error rolls the entire batch back.
      // A zero-row conditional INSERT means the expected version no longer matched.
      const current = await this.findMember(principal, id, true);
      if (current && current.version !== input.version)
        throw new MemberError("VERSION_CONFLICT", 409, "version_conflict");
      throw new MemberError("PERIOD_CONFLICT", 409, "history_conflict");
    }
    if (!results[0]?.meta.changes)
      throw new MemberError("VERSION_CONFLICT", 409, "version_conflict");
    return (await this.findMember(principal, id, true))!;
  }
  async addStatusHistory(
    principal: Principal,
    id: string,
    input: {
      status: MemberStatus;
      startedOn: string;
      endedOn?: string | null;
      reasonCode: string;
      version: number;
    },
    now: string,
  ): Promise<MemberDetail> {
    if (!(await this.findMember(principal, id, true)))
      throw new MemberError("RESOURCE_NOT_FOUND", 404, "member_not_visible");
    const historyId = crypto.randomUUID();
    let results: D1Result<unknown>[];
    try {
      results = await this.db.batch([
        this.db
          .prepare(
            `INSERT INTO member_status_history(id,member_id,status,started_on,ended_on,reason_code,decided_by,created_at)
             SELECT ?,m.id,?,?,?,?,?,? FROM members m WHERE m.id=? AND m.version=?`,
          )
          .bind(
            historyId,
            input.status,
            input.startedOn,
            input.endedOn ?? null,
            input.reasonCode,
            principal.actorId,
            now,
            id,
            input.version,
          ),
        this.db
          .prepare(
            `UPDATE member_status_history SET ended_on=?
             WHERE member_id=? AND ended_on IS NULL AND started_on<? AND id<>?
               AND EXISTS (SELECT 1 FROM member_status_history WHERE id=?)`,
          )
          .bind(input.startedOn, id, input.startedOn, historyId, historyId),
        this.db
          .prepare(
            `UPDATE members
             SET status=?,
                 left_on=CASE WHEN ?='LEFT' THEN ? WHEN ?='ACTIVE' THEN NULL ELSE left_on END,
                 version=version+1,updated_at=?
             WHERE id=? AND EXISTS (SELECT 1 FROM member_status_history WHERE id=?)`,
          )
          .bind(
            input.status,
            input.status,
            input.startedOn,
            input.status,
            now,
            id,
            historyId,
          ),
      ]);
    } catch {
      const current = await this.findMember(principal, id, true);
      if (current && current.version !== input.version)
        throw new MemberError("VERSION_CONFLICT", 409, "version_conflict");
      throw new MemberError("PERIOD_CONFLICT", 409, "history_conflict");
    }
    if (!results[0]?.meta.changes)
      throw new MemberError("VERSION_CONFLICT", 409, "version_conflict");
    return (await this.findMember(principal, id, true))!;
  }
}
function memberSummary(r: Record<string, unknown>): MemberSummary {
  return {
    id: String(r.id),
    displayName: String(r.display_name),
    status: r.status as MemberStatus,
    primaryUnitId: String(r.unit_id),
    version: Number(r.version),
    updatedAt: String(r.updated_at),
  };
}
function unitHistory(r: Record<string, unknown>): UnitHistory {
  return {
    id: String(r.id),
    unitId: String(r.unit_id),
    isPrimary: Number(r.is_primary) === 1,
    startedOn: String(r.started_on),
    endedOn: r.ended_on ? String(r.ended_on) : null,
    source: String(r.source),
  };
}
function statusHistory(r: Record<string, unknown>): StatusHistory {
  return {
    id: String(r.id),
    status: r.status as MemberStatus,
    startedOn: String(r.started_on),
    endedOn: r.ended_on ? String(r.ended_on) : null,
    reasonCode: String(r.reason_code),
  };
}
