import { getCloudflareContext } from "@opennextjs/cloudflare";
import { FakeAccessJwtVerifier } from "../../../../lib/auth/fake-verifier";
import { createMeHandler } from "../../../../lib/auth/me-handler";
import { D1AppUserRepository } from "../../../../lib/auth/repository";
import { createRequestId, errorEnvelope } from "../../../../lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const context = await getCloudflareContext({ async: true });
  const env = context.env as unknown as {
    DB: D1Database;
    AUTH_MODE?: string;
    ACCESS_ISSUER?: string;
    ACCESS_AUDIENCE?: string;
  };
  if (env.AUTH_MODE !== "fake" || !env.ACCESS_ISSUER || !env.ACCESS_AUDIENCE)
    return errorEnvelope(
      "AUTHENTICATION_UNAVAILABLE",
      createRequestId(request.headers.get("x-request-id")),
      503,
    );
  return createMeHandler({
    verifier: new FakeAccessJwtVerifier(env.ACCESS_ISSUER, env.ACCESS_AUDIENCE),
    users: new D1AppUserRepository(env.DB),
  })(request);
}
