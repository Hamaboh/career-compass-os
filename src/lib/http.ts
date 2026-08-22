export interface ErrorEnvelope {
  error: { code: string; message: string; requestId: string };
}

export function createRequestId(headerValue?: string | null): string {
  const candidate = headerValue?.trim();
  return candidate && /^[A-Za-z0-9_-]{8,128}$/.test(candidate)
    ? candidate
    : crypto.randomUUID();
}

export function errorEnvelope(
  code: string,
  requestId: string,
  status = 500,
): Response {
  const body: ErrorEnvelope = {
    error: { code, message: "リクエストを完了できませんでした。", requestId },
  };
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store", "x-request-id": requestId },
  });
}
