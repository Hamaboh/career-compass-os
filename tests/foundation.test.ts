import { describe, expect, it } from "vitest";
import { assertPlatformBindings } from "../src/lib/bindings";
import { parseEnvironment } from "../src/lib/environment";
import { createFakeBindings } from "../src/lib/fakes";
import { createRequestId, errorEnvelope } from "../src/lib/http";
import { redact, structuredLog } from "../src/lib/logger";
import { contentSecurityPolicy } from "../src/lib/security-headers";

describe("foundation boundaries", () => {
  it("validates isolated environments", () => {
    for (const APP_ENV of ["local", "ci", "preview", "production"] as const) {
      expect(
        parseEnvironment({
          APP_ENV,
          AUTH_MODE: APP_ENV === "production" ? "cloudflare-access" : "fake",
          ACCESS_ISSUER: "https://synthetic.cloudflareaccess.invalid",
          ACCESS_AUDIENCE: `career-compass-${APP_ENV}`,
        }).APP_ENV,
      ).toBe(APP_ENV);
    }
    expect(() => parseEnvironment({})).toThrow();
    expect(() => parseEnvironment({ APP_ENV: "staging" })).toThrow();
  });
  it("provides inert fake bindings", async () => {
    const bindings = createFakeBindings();
    assertPlatformBindings(bindings);
    expect(await bindings.ACCESS.verify("synthetic")).toBeNull();
    await expect(bindings.AI.propose("synthetic")).rejects.toThrow("disabled");
  });
  it("fails closed when a binding environment is missing or invalid", () => {
    const bindings = createFakeBindings();
    expect(() =>
      assertPlatformBindings({ ...bindings, APP_ENV: undefined }),
    ).toThrow("Required platform binding is unavailable or invalid");
    expect(() =>
      assertPlatformBindings({ ...bindings, APP_ENV: "invalid" as "ci" }),
    ).toThrow("Required platform binding is unavailable or invalid");
  });
  it("accepts safe request IDs and replaces unsafe IDs", () => {
    expect(createRequestId("safe_id-123")).toBe("safe_id-123");
    expect(createRequestId("bad id")).toMatch(/^[0-9a-f-]{36}$/);
  });
  it("returns a stable error envelope without internals", async () => {
    const response = errorEnvelope("INTERNAL_ERROR", "request_123", 500);
    expect(await response.json()).toEqual({
      error: {
        code: "INTERNAL_ERROR",
        message: "リクエストを完了できませんでした。",
      },
      requestId: "request_123",
    });
    expect(response.headers.get("x-request-id")).toBe("request_123");
  });
  it("returns field errors in the formal error envelope when supplied", async () => {
    const response = errorEnvelope("VALIDATION_ERROR", "request_456", 422, [
      { field: "title", message: "入力してください。" },
    ]);
    expect(await response.json()).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "リクエストを完了できませんでした。",
        fieldErrors: [{ field: "title", message: "入力してください。" }],
      },
      requestId: "request_456",
    });
    expect(response.status).toBe(422);
  });
  it("uses nonce-based script policy in production only", () => {
    const production = contentSecurityPolicy("testnonce", true);
    expect(production).toContain("script-src 'self' 'nonce-testnonce'");
    expect(production).not.toContain("'unsafe-inline'");
    expect(production).not.toContain("'unsafe-eval'");
    expect(production).toContain("frame-ancestors 'none'");
    expect(production).toContain("object-src 'none'");
    expect(production).toContain("base-uri 'self'");

    const development = contentSecurityPolicy("testnonce", false);
    expect(development).toContain(
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    );
  });
  it("redacts secret-shaped fields and bearer credentials", () => {
    const value = redact({
      authorization: "Bearer abc.def",
      nested: { email: "synthetic@example.invalid", safe: "Bearer hidden" },
    });
    expect(value).toEqual({
      authorization: "[REDACTED]",
      nested: { email: "[REDACTED]", safe: "[REDACTED]" },
    });
    expect(structuredLog({ token: "synthetic" })).not.toContain("synthetic");
  });
});
