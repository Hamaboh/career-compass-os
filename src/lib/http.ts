export interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    fieldErrors?: FieldError[];
  };
  requestId: string;
}

export interface FieldError {
  field: string;
  message: string;
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
  fieldErrors?: FieldError[],
): Response {
  const body: ErrorEnvelope = {
    error: {
      code,
      message: "リクエストを完了できませんでした。",
      ...(fieldErrors === undefined ? {} : { fieldErrors }),
    },
    requestId,
  };
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store", "x-request-id": requestId },
  });
}
