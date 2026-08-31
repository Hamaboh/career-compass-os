import { ZodError, type ZodType } from "zod";
import { authenticate } from "../auth/authenticate";
import { D1AuditWriter } from "../auth/audit";
import { AuthError } from "../auth/errors";
import { D1AppUserRepository } from "../auth/repository";
import type { AccessJwtVerifier, Principal } from "../auth/types";
import { createRequestId, errorEnvelope } from "../http";
import { MemberError } from "./errors";
import { D1MemberRepository } from "./repository";
import { MemberService } from "./service";
export interface MemberRuntime {
  db: D1Database;
  verifier: AccessJwtVerifier;
  privateFiles?: Pick<R2Bucket, "get" | "put" | "delete">;
}
export async function withMemberRuntime(
  request: Request,
  runtime: MemberRuntime,
  run: (
    service: MemberService,
    principal: Principal,
    requestId: string,
  ) => Promise<Response>,
): Promise<Response> {
  const requestId = createRequestId(request.headers.get("x-request-id"));
  try {
    const { principal } = await authenticate(
      request,
      runtime.verifier,
      new D1AppUserRepository(runtime.db),
    );
    return await run(
      new MemberService(
        new D1MemberRepository(runtime.db),
        new D1AuditWriter(runtime.db),
      ),
      principal,
      requestId,
    );
  } catch (error) {
    if (error instanceof AuthError)
      return errorEnvelope(error.code, requestId, error.status);
    if (error instanceof MemberError)
      return errorEnvelope(error.code, requestId, error.status);
    if (error instanceof ZodError)
      return errorEnvelope(
        "VALIDATION_ERROR",
        requestId,
        422,
        error.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
        })),
      );
    return errorEnvelope("INTERNAL_ERROR", requestId, 500);
  }
}
export async function strictJson<T>(
  request: Request,
  schema: ZodType<T>,
): Promise<T> {
  const text = await request.text();
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new MemberError("INVALID_JSON", 400, "invalid_json");
  }
  return schema.parse(value);
}
export function success(
  data: unknown,
  requestId: string,
  nextCursor: string | null = null,
  status = 200,
) {
  return Response.json(
    { data, meta: { requestId, nextCursor } },
    {
      status,
      headers: { "cache-control": "no-store", "x-request-id": requestId },
    },
  );
}
