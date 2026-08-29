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
});
