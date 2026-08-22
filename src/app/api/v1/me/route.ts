import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createMeHandler } from "../../../../lib/auth/me-handler";
import { D1AppUserRepository } from "../../../../lib/auth/repository";
import { createAccessJwtVerifier } from "../../../../lib/auth/verifier-factory";
import { parseEnvironment } from "../../../../lib/environment";
import { createRequestId, errorEnvelope } from "../../../../lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const context = await getCloudflareContext({ async: true });
  const env = context.env as unknown as {
    DB: D1Database;
    APP_ENV?: string;
    AUTH_MODE?: string;
    ACCESS_ISSUER?: string;
    ACCESS_AUDIENCE?: string;
  };
  try {
    const environment = parseEnvironment(env);
    return createMeHandler({
      verifier: createAccessJwtVerifier(environment),
      users: new D1AppUserRepository(env.DB),
    })(request);
  } catch {
    return errorEnvelope(
      "AUTHENTICATION_UNAVAILABLE",
      createRequestId(request.headers.get("x-request-id")),
      503,
    );
  }
}
