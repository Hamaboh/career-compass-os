import { AuthError } from "./errors";
import { capabilitiesFor, hasGlobalUnitAccess } from "./capabilities";
import type { AccessJwtVerifier, Principal } from "./types";
import type { AppUserRepository } from "./repository";

export function accessTokenFrom(request: Request): string {
  const assertion = request.headers.get("cf-access-jwt-assertion")?.trim();
  if (assertion) return assertion;
  const cookie = request.headers.get("cookie") ?? "";
  const value = cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith("CF_Authorization="))
    ?.slice("CF_Authorization=".length);
  if (!value)
    throw new AuthError("AUTHENTICATION_REQUIRED", 401, "access_token_missing");
  return value;
}

export async function authenticate(
  request: Request,
  verifier: AccessJwtVerifier,
  users: AppUserRepository,
  now = new Date(),
): Promise<{ principal: Principal; profile: { displayName: string } }> {
  const claims = await verifier.verify(accessTokenFrom(request), now);
  const user = await users.findCurrentBySubject(claims.subject, now);
  if (!user || user.status !== "ACTIVE")
    throw new AuthError(
      "APP_USER_FORBIDDEN",
      403,
      user ? "app_user_inactive" : "app_user_unregistered",
    );
  const capabilities = capabilitiesFor(user.roles);
  if (!capabilities.includes("PROFILE_READ"))
    throw new AuthError("CAPABILITY_FORBIDDEN", 403, "capability_missing");
  const unitScopes = user.unitScopes.filter((scope) => {
    const validFrom = new Date(scope.validFrom);
    const validTo = scope.validTo ? new Date(scope.validTo) : null;
    return validFrom <= now && (!validTo || validTo > now);
  });
  const globalUnitRead = hasGlobalUnitAccess(capabilities);
  if (!globalUnitRead && unitScopes.length === 0)
    throw new AuthError("APP_USER_FORBIDDEN", 403, "unit_scope_required");
  return {
    principal: {
      actorId: user.id,
      accessSubject: claims.subject,
      status: "ACTIVE",
      roles: user.roles,
      capabilities,
      unitScopes,
      globalUnitRead,
      createdAt: now.toISOString(),
    },
    profile: { displayName: user.displayName },
  };
}
