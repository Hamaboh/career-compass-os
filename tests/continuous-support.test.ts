import { describe, expect, it } from "vitest";
import type { Principal } from "../src/lib/auth/types";
import { deterministicSupportProposals } from "../src/lib/continuous-support/fake";
import { ContinuousSupportRepository } from "../src/lib/continuous-support/repository";
import {
  indicatorInput,
  oneOnOneEntryInput,
  progressInput,
  reminderInput,
} from "../src/lib/continuous-support/schemas";

describe("continuous support human and AI boundary", () => {
  it("treats personal indicators as Member self-reports", () => {
    expect(() =>
      indicatorInput.parse({
        version: 1,
        metricType: "WHY_SATISFACTION",
        value: 70,
        sourceType: "AI_REFERENCE",
        basisNote: "synthetic",
      }),
    ).toThrow(/本人の自己申告/);
    expect(
      indicatorInput.parse({
        version: 1,
        metricType: "SMART_QUALITY",
        value: 80,
        sourceType: "AI_REFERENCE",
        basisNote: "axis reference only",
      }).sourceType,
    ).toBe("AI_REFERENCE");
  });

  it("does not allow confidential text into an AI-sendable record", () => {
    expect(() =>
      progressInput.parse({
        version: 1,
        state: "IN_PROGRESS",
        note: "synthetic",
        blocker: "",
        provenanceType: "MEMBER_STATEMENT",
        confidentiality: "CONFIDENTIAL",
        aiSendPolicy: "AI_SEND_ALLOWED",
      }),
    ).toThrow(/AI送信不可/);
  });

  it("does not let a UL mark their own entry as Member-confirmed", () => {
    expect(() =>
      oneOnOneEntryInput.parse({
        version: 1,
        entryType: "AGREEMENT",
        body: "synthetic agreement",
        provenanceType: "UL_OBSERVATION",
        confidentiality: "NORMAL",
        aiSendPolicy: "AI_SEND_ALLOWED",
        confirmedWithMember: true,
      }),
    ).toThrow(/本人確認済み/);
  });

  it("requires concrete evidence for a Member-confirmed entry", () => {
    expect(() =>
      oneOnOneEntryInput.parse({
        version: 1,
        entryType: "AGREEMENT",
        body: "synthetic agreement",
        provenanceType: "MEMBER_CONFIRMED",
        confidentiality: "NORMAL",
        aiSendPolicy: "AI_SEND_ALLOWED",
        confirmedWithMember: true,
      }),
    ).toThrow(/方法、日時、本人の言葉/);
  });

  it("keeps deterministic output as proposals, not human facts", () => {
    const proposals = deterministicSupportProposals();
    expect(proposals).toHaveLength(3);
    expect(proposals.map((proposal) => proposal.type)).toEqual([
      "NEXT_CHALLENGE",
      "NEXT_ACTION",
      "GOAL_CHANGE",
    ]);
    expect(proposals.every((proposal) => proposal.rationale.length > 0)).toBe(
      true,
    );
  });

  it("requires a bounded per-user reminder cadence", () => {
    expect(() =>
      reminderInput.parse({
        subjectType: "GOAL",
        subjectId: "goal-a",
        reminderType: "GOAL_UPDATE",
        cadenceDays: 366,
        nextRunAt: "2026-09-01T00:00:00.000Z",
        graceMinutes: 0,
        stopOnCompletion: true,
      }),
    ).toThrow();
  });

  it("rejects reminder types attached to the wrong subject", () => {
    expect(() =>
      reminderInput.parse({
        subjectType: "GOAL",
        subjectId: "goal-a",
        reminderType: "ACTION_DUE",
        cadenceDays: 7,
        nextRunAt: "2026-09-01T00:00:00.000Z",
        graceMinutes: 0,
        stopOnCompletion: true,
      }),
    ).toThrow(/対象とリマインダー種別/);
  });
});

describe("continuous support server-side visibility", () => {
  it("conceals a cross-Unit Member before any support record is queried", async () => {
    const issued: string[] = [];
    const db = {
      prepare(query: string) {
        issued.push(query);
        return {
          bind() {
            return this;
          },
          async first() {
            return null;
          },
        };
      },
      async batch() {
        return [];
      },
    };
    const principal = {
      actorId: "actor-a",
      capabilities: ["UNIT_READ_SCOPED"],
      unitScopes: [
        { unitId: "unit-a", validFrom: "2026-01-01", validTo: null },
      ],
      globalUnitRead: false,
    } as Principal;
    await expect(
      new ContinuousSupportRepository(db as unknown as D1Database).overview(
        principal,
        "member-other-unit",
      ),
    ).rejects.toMatchObject({ status: 404 });
    expect(issued).toHaveLength(1);
    expect(issued[0]).toContain("h.unit_id IN");
  });

  it("does not allow an Executive global reader to mutate support data", async () => {
    const db = {
      prepare() {
        return {
          bind() {
            return this;
          },
          async first() {
            return null;
          },
        };
      },
      async batch() {
        throw new Error("write must not be reached");
      },
    };
    const executive = {
      actorId: "executive-a",
      accessSubject: "synthetic-executive",
      status: "ACTIVE",
      roles: ["EXECUTIVE"],
      capabilities: ["UNIT_READ_ALL"],
      unitScopes: [],
      globalUnitRead: true,
      createdAt: "2026-01-01T00:00:00.000Z",
    } satisfies Principal;
    await expect(
      new ContinuousSupportRepository(
        db as unknown as D1Database,
      ).createOneOnOne(
        executive,
        "member-a",
        {
          scheduledAt: "2026-09-01T00:00:00.000Z",
          theme: "synthetic",
          nextAt: null,
        },
        "request-a",
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("applies goal revision ACL and record ACL predicates to history queries", async () => {
    const issued: string[] = [];
    const db = {
      prepare(query: string) {
        issued.push(query);
        return {
          bind() {
            return this;
          },
          async first() {
            return query.includes("SELECT h.unit_id")
              ? { unit_id: "unit-a" }
              : null;
          },
          async all() {
            if (query.includes("SELECT g.id,g.version,g.lifecycle_status"))
              return {
                results: [
                  {
                    id: "goal-a",
                    version: 1,
                    current_version_id: "version-a",
                    unit_id: "unit-a",
                    title: "Synthetic",
                  },
                ],
              };
            if (query.includes("SELECT * FROM one_on_ones"))
              return { results: [{ id: "meeting-a" }] };
            return { results: [] };
          },
        };
      },
      async batch() {
        return [];
      },
    };
    const principal = {
      actorId: "actor-a",
      capabilities: ["UNIT_EDIT_SCOPED"],
      unitScopes: [
        { unitId: "unit-a", validFrom: "2026-01-01", validTo: null },
      ],
      globalUnitRead: false,
    } as Principal;
    await new ContinuousSupportRepository(db as unknown as D1Database).overview(
      principal,
      "member-a",
    );
    const progressSql = issued.find((query) =>
      query.includes("FROM progress_entries"),
    );
    const reflectionSql = issued.find((query) =>
      query.includes("FROM reflections"),
    );
    const oneOnOneSql = issued.find((query) =>
      query.includes("FROM one_on_one_entries"),
    );
    for (const sql of [progressSql, reflectionSql, oneOnOneSql]) {
      expect(sql).toContain("record_access_grants");
      expect(sql).toContain("a.expires_at");
    }
    expect(progressSql).toContain("a.resource_id=v.id");
    expect(progressSql).toContain("pa.resource_id=p.id");
    expect(reflectionSql).toContain("ra.resource_id=r.id");
  });

  it("aggregates same-day reminders per recipient and Member", async () => {
    const issued: { query: string; bindings: unknown[] }[] = [];
    const due = (id: string, type: string) => ({
      id,
      member_id: "member-a",
      unit_id: "unit-a",
      subject_type: "GOAL",
      subject_id: "goal-a",
      reminder_type: type,
      next_run_at: "2026-09-01T00:00:00.000Z",
      cadence_days: 7,
      stop_on_completion: 1,
      version: 1,
    });
    const db = {
      prepare(query: string) {
        const statement = { query, bindings: [] as unknown[] };
        issued.push(statement);
        return {
          bind(...bindings: unknown[]) {
            statement.bindings = bindings;
            return this;
          },
          async all() {
            if (query.includes("FROM reminder_rules"))
              return {
                results: [
                  due("rule-a", "GOAL_UPDATE"),
                  due("rule-b", "SMART_RECHECK"),
                ],
              };
            return { results: [] };
          },
          async first() {
            return { completed: 0 };
          },
          async run() {
            return { meta: { changes: 1 } };
          },
        };
      },
      async batch(statements: unknown[]) {
        return statements.map(() => ({ meta: { changes: 1 } }));
      },
    };
    const principal = {
      actorId: "actor-a",
      capabilities: ["UNIT_EDIT_SCOPED"],
      unitScopes: [
        { unitId: "unit-a", validFrom: "2026-01-01", validTo: null },
      ],
      globalUnitRead: false,
    } as Principal;
    await new ContinuousSupportRepository(
      db as unknown as D1Database,
    ).materializeDue(principal, "2026-09-01T01:00:00.000Z", "request-a");
    const notificationInserts = issued.filter(({ query }) =>
      query.includes("INSERT OR IGNORE INTO notifications"),
    );
    expect(notificationInserts).toHaveLength(2);
    expect(notificationInserts[0]?.bindings[0]).toBe(
      notificationInserts[1]?.bindings[0],
    );
    expect(String(notificationInserts[0]?.bindings[0])).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(notificationInserts[0]?.bindings[9]).toBe(
      notificationInserts[1]?.bindings[9],
    );
    expect(
      issued.filter(({ query }) =>
        query.includes("INSERT OR IGNORE INTO notification_items"),
      ),
    ).toHaveLength(2);
  });
});
