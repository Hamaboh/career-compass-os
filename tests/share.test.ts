import { describe, expect, it, vi } from "vitest";
import type { Principal } from "../src/lib/auth/types";
import {
  escapeHtml,
  publicShareCsp,
  renderShareHtml,
} from "../src/lib/share/html";
import { confirmationInput, createTokenInput } from "../src/lib/share/schemas";
import { ShareRepository } from "../src/lib/share/repository";

const principal = (overrides: Partial<Principal> = {}): Principal => ({
  actorId: "actor-1",
  accessSubject: "subject-1",
  status: "ACTIVE",
  roles: ["UL"],
  capabilities: ["UNIT_READ_SCOPED", "UNIT_EDIT_SCOPED"],
  unitScopes: [
    { unitId: "unit-a", validFrom: "2026-01-01T00:00:00.000Z", validTo: null },
  ],
  globalUnitRead: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

function emptyDatabase() {
  const first = vi.fn().mockResolvedValue(null);
  const run = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
  const bind = vi.fn().mockReturnValue({ first, run });
  const prepare = vi.fn().mockReturnValue({ bind });
  return { db: { prepare } as unknown as D1Database, prepare, bind, first };
}

describe("share HTML fixed-template boundary", () => {
  it("escapes every user-controlled HTML value and emits no executable content", () => {
    const html = renderShareHtml({
      memberName: `<img src=x onerror="alert(1)">`,
      createdAt: "2026-08-31T00:00:00.000Z",
      expiresAt: "2026-09-07T00:00:00.000Z",
      versionLabels: ["Goal <script>alert(1)</script>"],
      sections: [
        {
          title: "<iframe>",
          items: [
            {
              heading: "<b>heading</b>",
              lines: ["A & B", "javascript:alert(1)"],
            },
          ],
        },
      ],
    });
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<iframe");
    expect(html).not.toMatch(/<[^>]+\sonerror=/i);
    expect(html).not.toMatch(/<[^>]+\sonclick=/i);
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(html).toContain("A &amp; B");
    expect(html).toContain("noindex,nofollow,noarchive");
    expect(html).toContain('href="?download=1"');
  });

  it("uses a public CSP with no script, external resource, frame, or form allowance", () => {
    expect(publicShareCsp).toContain("default-src 'none'");
    expect(publicShareCsp).toContain("script-src 'none'");
    expect(publicShareCsp).toContain("frame-ancestors 'none'");
    expect(publicShareCsp).not.toContain("unsafe-inline");
    expect(publicShareCsp).not.toContain("https:");
  });

  it("escapes quotes and apostrophes deterministically", () => {
    expect(escapeHtml(`<&>"'`)).toBe("&lt;&amp;&gt;&quot;&#39;");
  });
});

describe("share token and confirmation contracts", () => {
  it("enforces the 7 to 30 day token range", () => {
    expect(() =>
      createTokenInput.parse({
        version: 1,
        expiresInDays: 6,
        idempotencyKey: "request-123",
      }),
    ).toThrow();
    expect(() =>
      createTokenInput.parse({
        version: 1,
        expiresInDays: 31,
        idempotencyKey: "request-123",
      }),
    ).toThrow();
    expect(
      createTokenInput.parse({
        version: 1,
        expiresInDays: 7,
        idempotencyKey: "request-123",
      }).expiresInDays,
    ).toBe(7);
  });

  it("requires concrete member words and an explicit non-view confirmation method", () => {
    expect(() =>
      confirmationInput.parse({
        version: 1,
        method: "SHARED_HTML",
        result: "APPROVED",
        memberWords: "ok",
        confirmedAt: "2026-08-31T00:00:00.000Z",
      }),
    ).toThrow();
    expect(() =>
      confirmationInput.parse({
        version: 1,
        method: "IN_PERSON",
        result: "APPROVED",
        memberWords: "",
        confirmedAt: "2026-08-31T00:00:00.000Z",
      }),
    ).toThrow();
  });
});

describe("share repository authorization and public denial", () => {
  it("returns the same not-found boundary for a cross-unit snapshot", async () => {
    const { db, prepare, bind } = emptyDatabase();
    const repository = new ShareRepository(db, {
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    } as unknown as R2Bucket);
    await expect(
      repository.preview(principal(), "snapshot-b"),
    ).rejects.toMatchObject({
      code: "RESOURCE_NOT_FOUND",
      status: 404,
    });
    expect(String(prepare.mock.calls[0]?.[0])).toContain("unit_id IN (?)");
    expect(bind).toHaveBeenCalledWith("snapshot-b", "unit-a");
  });

  it("never lets an EXECUTIVE mutate a snapshot", async () => {
    const { db, prepare } = emptyDatabase();
    const repository = new ShareRepository(db, {
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    } as unknown as R2Bucket);
    await expect(
      repository.createToken(
        principal({
          roles: ["EXECUTIVE"],
          capabilities: ["UNIT_READ_ALL", "REVIEW_ALL"],
          unitScopes: [],
          globalUnitRead: true,
        }),
        "snapshot-a",
        1,
        7,
        "request-123",
        "request-id",
      ),
    ).rejects.toMatchObject({ code: "RESOURCE_NOT_FOUND", status: 404 });
    expect(prepare).not.toHaveBeenCalled();
  });

  it("does not read R2 when a public token is invalid, expired, or revoked", async () => {
    const { db } = emptyDatabase();
    const get = vi.fn();
    const repository = new ShareRepository(db, {
      get,
      put: vi.fn(),
      delete: vi.fn(),
    } as unknown as R2Bucket);
    await expect(
      repository.publicHtml("a".repeat(43), "request-id"),
    ).rejects.toMatchObject({ code: "RESOURCE_NOT_FOUND", status: 404 });
    expect(get).not.toHaveBeenCalled();
  });

  it("rate-limits public token attempts before any R2 access", async () => {
    const { db, first } = emptyDatabase();
    first.mockResolvedValueOnce({ attempt_count: 61 });
    const get = vi.fn();
    const repository = new ShareRepository(db, {
      get,
      put: vi.fn(),
      delete: vi.fn(),
    } as unknown as R2Bucket);
    await expect(
      repository.publicHtml("a".repeat(43), "request-id", "192.0.2.1"),
    ).rejects.toMatchObject({ code: "RATE_LIMITED", status: 429 });
    expect(get).not.toHaveBeenCalled();
  });
});
