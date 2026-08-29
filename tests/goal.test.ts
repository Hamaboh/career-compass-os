import { describe, expect, it } from "vitest";
import {
  finalizeInput,
  goalInput,
  revisionInput,
} from "../src/lib/goal/schemas";
import { GoalRepository } from "../src/lib/goal/repository";
import type { Principal } from "../src/lib/auth/types";

const base = {
  entryRoute: "DIRECT_GOAL" as const,
  title: "Synthetic goal",
  description: "A member-authored direction",
  targetDate: null,
  successCriteria: "A synthetic deliverable exists",
  reviewCycle: "monthly",
  provenanceType: "MEMBER_STATEMENT" as const,
  confidentiality: "NORMAL" as const,
  visibility: "UL_AND_EXEC" as const,
  aiSendPolicy: "AI_SEND_ALLOWED" as const,
  links: [],
};
describe("goal formation validation", () => {
  it("permits a goal without KPI or Mission links", () => {
    expect(goalInput.parse(base).links).toEqual([]);
  });
  it("accepts only implemented optional reference types", () => {
    expect(
      goalInput.parse({
        ...base,
        links: [
          {
            type: "FUTURE_VISION",
            referenceId: "vision-1",
            relevanceNote: "supports direction",
          },
        ],
      }).links,
    ).toHaveLength(1);
    expect(() =>
      goalInput.parse({
        ...base,
        links: [{ type: "KPI", referenceId: "arbitrary", relevanceNote: "" }],
      }),
    ).toThrow();
  });
  it("requires an optimistic version and reason for revisions", () => {
    expect(
      revisionInput.parse({
        ...base,
        version: 2,
        changeReason: "Member requested a change",
      }).version,
    ).toBe(2);
    expect(() =>
      revisionInput.parse({ ...base, version: 2, changeReason: "" }),
    ).toThrow();
  });
  it("does not let UL observations masquerade as member confirmation", () => {
    expect(() =>
      goalInput.parse({ ...base, provenanceType: "MEMBER_CONFIRMED" }),
    ).toThrow();
  });
  it("requires a complete exception for any incomplete SMART axis", () => {
    expect(() =>
      finalizeInput.parse({
        version: 1,
        memberWords: "This is what I want",
        method: "IN_PERSON",
        confirmedAt: "2026-08-29T00:00:00.000Z",
        checks: Array(7).fill(true),
        smart: {
          specific: "OK",
          measurable: "MISSING",
          achievable: "OK",
          relevant: "OK",
          timeBound: "OK",
          reasons: {},
        },
      }),
    ).toThrow(/SMART不足/);
  });
});

describe("goal repository confidentiality boundary", () => {
  it("applies creator-or-active-ACL concealment to every goal operation", async () => {
    const sql: string[] = [];
    const db = {
      prepare(query: string) {
        sql.push(query);
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
            return { results: [] };
          },
        };
      },
      async batch() {
        return [];
      },
    };
    const p = {
      actorId: "actor-a",
      roles: ["UL"],
      capabilities: ["UNIT_EDIT_SCOPED"],
      globalUnitRead: false,
      unitScopes: [
        { unitId: "unit-a", validFrom: "2026-01-01", validTo: null },
      ],
    } as Principal;
    await expect(
      new GoalRepository(db as unknown as D1Database).action(
        p,
        "member-a",
        "goal-a",
        { version: 1, title: "x", provenanceType: "UL_OBSERVATION" },
        "rid",
      ),
    ).rejects.toMatchObject({ status: 404 });
    const protectedSql = sql.find((q) =>
      q.includes("JOIN goal_versions v ON v.id=g.current_version_id"),
    );
    expect(protectedSql).toContain("g.created_by=?");
    expect(protectedSql).toContain("record_access_grants a");
    expect(protectedSql).toContain("a.expires_at");
  });

  it("applies the version ACL in the history query issued by list", async () => {
    const issued: { query: string; bindings: unknown[] }[] = [];
    const db = {
      prepare(query: string) {
        const statement = { query, bindings: [] as unknown[] };
        issued.push(statement);
        return {
          bind(...bindings: unknown[]) {
            statement.bindings = bindings;
            return this;
          },
          async first() {
            return query.includes("SELECT h.unit_id")
              ? { unit_id: "unit-a" }
              : null;
          },
          async all() {
            return {
              results: query.includes("SELECT g.*,v.title")
                ? [{ id: "goal-a", current_version_id: "version-current" }]
                : [],
            };
          },
        };
      },
      async batch() {
        return [];
      },
    };
    const p = {
      actorId: "actor-a",
      roles: ["UL"],
      capabilities: ["UNIT_EDIT_SCOPED"],
      globalUnitRead: false,
      unitScopes: [
        { unitId: "unit-a", validFrom: "2026-01-01", validTo: null },
      ],
    } as Principal;

    await new GoalRepository(db as unknown as D1Database).list(p, "member-a");

    const history = issued.find(({ query }) =>
      query.includes("FROM goal_versions v JOIN goals g ON g.id=v.goal_id"),
    );
    expect(history).toBeDefined();
    expect(history?.query).toContain("v.visibility='UL_AND_EXEC'");
    expect(history?.query).toContain("g.created_by=?");
    expect(history?.query).toContain("a.resource_id=v.id");
    expect(history?.query).toContain("a.expires_at");
    expect(history?.bindings).toEqual(["goal-a", "actor-a", "actor-a"]);
  });

  it("maps only the database CAS signal to VERSION_CONFLICT", async () => {
    const queries: string[] = [];
    const database = (failure: Error) => ({
      prepare(query: string) {
        queries.push(query);
        return {
          bind() {
            return this;
          },
          async first() {
            if (query.includes("SELECT h.unit_id"))
              return { unit_id: "unit-a" };
            if (query.includes("JOIN goal_versions v"))
              return {
                id: "goal-a",
                current_version_id: "version-a",
                current_version_no: 1,
                version: 1,
              };
            return null;
          },
        };
      },
      async batch() {
        throw failure;
      },
    });
    const p = {
      actorId: "actor-a",
      roles: ["UL"],
      capabilities: ["UNIT_EDIT_SCOPED"],
      globalUnitRead: false,
      unitScopes: [
        { unitId: "unit-a", validFrom: "2026-01-01", validTo: null },
      ],
    } as Principal;
    const input = revisionInput.parse({
      ...base,
      version: 1,
      changeReason: "changed",
    });
    await expect(
      new GoalRepository(
        database(
          new Error("goal revision version conflict"),
        ) as unknown as D1Database,
      ).revise(p, "member-a", "goal-a", input, "rid-a"),
    ).rejects.toMatchObject({ status: 409, code: "VERSION_CONFLICT" });
    await expect(
      new GoalRepository(
        database(
          new Error("goal link owner mismatch"),
        ) as unknown as D1Database,
      ).revise(p, "member-a", "goal-a", input, "rid-b"),
    ).rejects.toMatchObject({ status: 422, code: "GOAL_REVISION_INVALID" });
    expect(
      queries.some((query) => query.includes("goal_revision_guards")),
    ).toBe(true);
  });
});
