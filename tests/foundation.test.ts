import { describe, expect, it } from "vitest";
import { assertPlatformBindings } from "../src/lib/bindings";
import { parseEnvironment } from "../src/lib/environment";
import { createFakeBindings } from "../src/lib/fakes";
import { createRequestId, errorEnvelope } from "../src/lib/http";
import { redact, structuredLog } from "../src/lib/logger";

describe("foundation boundaries", () => {
  it("validates isolated environments", () => {
    expect(parseEnvironment({ APP_ENV: "ci" }).APP_ENV).toBe("ci");
    expect(() => parseEnvironment({ APP_ENV: "staging" })).toThrow();
  });
  it("provides inert fake bindings", async () => {
    const bindings = createFakeBindings();
    assertPlatformBindings(bindings);
    expect(await bindings.ACCESS.verify("synthetic")).toBeNull();
    await expect(bindings.AI.propose("synthetic")).rejects.toThrow("disabled");
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
        requestId: "request_123",
      },
    });
    expect(response.headers.get("x-request-id")).toBe("request_123");
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
