import { createRequestId, errorEnvelope } from "../http";
import { authenticate } from "./authenticate";
import { AuthError } from "./errors";
import type { AppUserRepository } from "./repository";
import type { AccessJwtVerifier } from "./types";

interface Dependencies {
  verifier: AccessJwtVerifier;
  users: AppUserRepository;
  now?: () => Date;
}

export function createMeHandler(dependencies: Dependencies) {
  return async function GET(request: Request): Promise<Response> {
    const requestId = createRequestId(request.headers.get("x-request-id"));
    try {
      const { principal, profile } = await authenticate(
        request,
        dependencies.verifier,
        dependencies.users,
        dependencies.now?.(),
      );
      return Response.json(
        {
          data: {
            actorId: principal.actorId,
            status: principal.status,
            roles: principal.roles,
            unitScopes: principal.unitScopes,
            capabilities: principal.capabilities,
            profile,
          },
          meta: { requestId, nextCursor: null },
        },
        { headers: { "cache-control": "no-store", "x-request-id": requestId } },
      );
    } catch (error) {
      if (error instanceof AuthError)
        return errorEnvelope(error.code, requestId, error.status);
      return errorEnvelope("INTERNAL_ERROR", requestId);
    }
  };
}
