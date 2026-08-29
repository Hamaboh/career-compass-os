import { describe, expect, it } from "vitest";
import { finalizeInput, goalInput } from "../src/lib/goal/schemas";

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
