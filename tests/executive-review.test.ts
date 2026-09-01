import { describe, expect, it } from "vitest";
import type { Principal } from "../src/lib/auth/types";
import {
  calculateTurnover,
  classifyResponseWindow,
  secondBusinessDayOfFollowingMonth,
} from "../src/lib/executive/calculations";
import {
  executiveRead,
  policyWrite,
  scopedReviewWrite,
} from "../src/lib/executive/http";
import {
  holidayCalendarInput,
  policyVersionInput,
  reviewCommentInput,
} from "../src/lib/executive/schemas";
import { ExecutiveRepository } from "../src/lib/executive/repository";

const db = {} as D1Database;
const executive = {
  actorId: "executive",
  accessSubject: "synthetic-executive",
  status: "ACTIVE",
  roles: ["EXECUTIVE"],
  capabilities: ["UNIT_READ_ALL", "REVIEW_ALL"],
  unitScopes: [],
  globalUnitRead: true,
  createdAt: "2026-01-01T00:00:00.000Z",
} as Principal;
const ul = {
  actorId: "ul",
  accessSubject: "synthetic-ul",
  status: "ACTIVE",
  roles: ["UL"],
  capabilities: ["UNIT_READ_SCOPED", "UNIT_EDIT_SCOPED"],
  unitScopes: [{ unitId: "unit-a", validFrom: "2026-01-01", validTo: null }],
  globalUnitRead: false,
  createdAt: "2026-01-01T00:00:00.000Z",
} as Principal;

describe("Implementation 8 deterministic reference calculations", () => {
  it("truncates turnover to one decimal and keeps the raw components", () => {
    const result = calculateTurnover(8, 9, 1);
    expect(result.averageCount).toBe(8.5);
    expect(result.rawRate).toBeCloseTo(11.7647);
    expect(result.displayRate).toBe(11.7);
    expect(result.isEightOrMore).toBe(true);
    expect(result.disclaimer).toMatch(/正式評価ではありません/);
  });

  it("returns calculable=false instead of presenting zero percent for a zero average", () => {
    expect(calculateTurnover(0, 0, 0)).toMatchObject({
      calculable: false,
      rawRate: null,
      displayRate: null,
      isEightOrMore: false,
    });
  });

  it("uses the second Japanese business day across weekend, holiday and year boundary", () => {
    expect(
      secondBusinessDayOfFollowingMonth(
        "2026-12",
        new Set(["2027-01-01", "2027-01-04"]),
      ),
    ).toBe("2027-01-06");
  });

  it("treats exactly 24 hours as a reference event and never infers missing facts", () => {
    const exact = classifyResponseWindow(
      "2026-08-01T00:00:00.000Z",
      "2026-08-02T00:00:00.000Z",
      "2026-08-02T00:00:00.000Z",
    );
    expect(exact.referenceEvent).toBe(true);
    expect(exact.source).toBe("UL_RECORDED_FACT");
    expect(
      classifyResponseWindow(
        "2026-08-01T00:00:00.000Z",
        null,
        "2026-08-01T23:59:59.999Z",
      ).classification,
    ).toBe("PENDING_BEFORE_THRESHOLD");
  });
});

describe("Implementation 8 policy and review boundaries", () => {
  it("derives Management DRAFT on the server contract instead of accepting a caller flag", () => {
    const parsed = policyVersionInput.parse({
      documentVersion: 1,
      versionNo: "synthetic-v1",
      effectiveFrom: "2026-01-01",
      effectiveTo: null,
      status: "ACTIVE",
      checksum: "a".repeat(64),
      items: [
        {
          category: "Management",
          code: "M-1",
          title: "Synthetic",
          description: "",
          criteria: {},
        },
      ],
    });
    expect(parsed.items[0]?.category).toBe("Management");
    expect(() =>
      policyVersionInput.parse({
        ...parsed,
        items: [{ ...parsed.items[0], draft: false }],
      }),
    ).toThrow();
  });

  it("requires optimistic-lock versions for every review action", () => {
    expect(() =>
      reviewCommentInput.parse({
        disposition: "RETURN",
        body: "Synthetic clarification request",
      }),
    ).toThrow();
  });

  it("binds every holiday to its versioned calendar year", () => {
    expect(() =>
      holidayCalendarInput.parse({
        year: 2027,
        versionNo: "synthetic-2027-v1",
        status: "ACTIVE",
        checksum: "c".repeat(64),
        holidays: [{ date: "2026-12-31", name: "Synthetic mismatch" }],
      }),
    ).toThrow(/対象年/);
  });

  it("keeps Executive read/review-only and prevents UL impersonation", () => {
    expect(executiveRead(db, executive)).toBeDefined();
    expect(() => policyWrite(db, executive)).toThrow(/CAPABILITY_FORBIDDEN/);
    expect(() =>
      scopedReviewWrite(db, executive, "unit-a", "UL_RESPONSE"),
    ).toThrow(/CAPABILITY_FORBIDDEN/);
  });

  it("limits UL review responses to their own Unit", () => {
    expect(scopedReviewWrite(db, ul, "unit-a", "UL_RESPONSE")).toBeDefined();
    expect(() => scopedReviewWrite(db, ul, "unit-b", "UL_RESPONSE")).toThrow(
      /RESOURCE_NOT_FOUND/,
    );
    expect(() => scopedReviewWrite(db, ul, "unit-a", "CONFIRM")).toThrow(
      /CAPABILITY_FORBIDDEN/,
    );
  });

  it("filters every review target by revision and confidentiality before returning summaries", async () => {
    const issued: string[] = [];
    const scopedDb = {
      prepare(query: string) {
        issued.push(query);
        return {
          bind() {
            return this;
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
    await new ExecutiveRepository(
      scopedDb as unknown as D1Database,
    ).listReviews(executive);
    expect(issued).toHaveLength(1);
    expect(issued[0]).toContain("v.version_no=r.revision_no");
    expect(issued[0]).toContain("p.confidentiality='NORMAL'");
    expect(issued[0]).toContain("f.confidentiality='NORMAL'");
    expect(issued[0]).toContain("e.confidentiality='NORMAL'");
    expect(issued[0]).toContain("e.entry_type<>'RAW_NOTE'");
    expect(issued[0]).toContain("target_summary");
  });

  it("returns 409 without treating a stale review action as success", async () => {
    const staleDb = {
      prepare() {
        return {
          bind() {
            return this;
          },
          async first() {
            return { unit_id: "unit-a", status: "RETURNED", version: 2 };
          },
        };
      },
      async batch() {
        return [
          { meta: { changes: 0 } },
          { meta: { changes: 0 } },
          { meta: { changes: 0 } },
        ];
      },
    };
    await expect(
      new ExecutiveRepository(
        staleDb as unknown as D1Database,
      ).addReviewComment(
        ul,
        "review-a",
        {
          version: 1,
          disposition: "UL_RESPONSE",
          body: "Synthetic response",
        },
        "request-a",
      ),
    ).rejects.toMatchObject({ status: 409, code: "VERSION_CONFLICT" });
  });

  it("loads holidays from the active server calendar", async () => {
    const calendarDb = {
      prepare(query: string) {
        return {
          bind() {
            return this;
          },
          async first() {
            return query.includes("holiday_calendars")
              ? { id: "calendar-a", version_no: "2027-v1" }
              : null;
          },
          async all() {
            return { results: [{ holiday_date: "2027-01-01" }] };
          },
        };
      },
      async batch() {
        return [];
      },
    };
    await expect(
      new ExecutiveRepository(
        calendarDb as unknown as D1Database,
      ).calculateBusinessDay("2026-12"),
    ).resolves.toMatchObject({
      dueDate: "2027-01-05",
      calendarVersion: "2027-v1",
    });
  });
});
