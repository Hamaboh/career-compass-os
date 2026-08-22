const sensitiveKeys =
  /authorization|cookie|token|secret|password|email|name|prompt|body/i;
const bearer = /Bearer\s+[A-Za-z0-9._~+\/-]+=*/gi;

export function redact(value: unknown): unknown {
  if (typeof value === "string") return value.replace(bearer, "[REDACTED]");
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        sensitiveKeys.test(key) ? "[REDACTED]" : redact(entry),
      ]),
    );
  return value;
}

export function structuredLog(event: Record<string, unknown>): string {
  return JSON.stringify(
    redact({ timestamp: new Date().toISOString(), ...event }),
  );
}
