import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createAccessJwtVerifier } from "../auth/verifier-factory";
import { parseEnvironment } from "../environment";
import type { MemberRuntime } from "./http";
export async function memberRuntime(): Promise<MemberRuntime> {
  const context = await getCloudflareContext({ async: true });
  const env = context.env as unknown as {
    DB: D1Database;
    APP_ENV?: string;
    AUTH_MODE?: string;
    ACCESS_ISSUER?: string;
    ACCESS_AUDIENCE?: string;
    PRIVATE_FILES: Pick<R2Bucket, "get" | "put" | "delete">;
  };
  return {
    db: env.DB,
    verifier: createAccessJwtVerifier(parseEnvironment(env)),
    privateFiles: env.PRIVATE_FILES,
  };
}
