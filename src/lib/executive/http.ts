import { AuthError } from "../auth/errors";
import type { Principal } from "../auth/types";
import { ExecutiveRepository } from "./repository";

export function executiveRead(db: D1Database, principal: Principal) {
  if (!principal.capabilities.includes("REVIEW_ALL"))
    throw new AuthError(
      "CAPABILITY_FORBIDDEN",
      403,
      "review_capability_required",
    );
  return new ExecutiveRepository(db);
}

export function policyWrite(db: D1Database, principal: Principal) {
  if (!principal.roles.includes("SYSTEM_ADMIN"))
    throw new AuthError("CAPABILITY_FORBIDDEN", 403, "policy_admin_required");
  return new ExecutiveRepository(db);
}

export function policyRead(db: D1Database, principal: Principal) {
  if (
    !principal.capabilities.includes("UNIT_READ_ALL") &&
    !principal.capabilities.includes("UNIT_READ_SCOPED")
  )
    throw new AuthError("CAPABILITY_FORBIDDEN", 403, "policy_read_required");
  return new ExecutiveRepository(db);
}

export function scopedReviewWrite(
  db: D1Database,
  principal: Principal,
  unitId: string,
  disposition?: string,
) {
  if (principal.capabilities.includes("REVIEW_ALL")) {
    if (disposition === "UL_RESPONSE")
      throw new AuthError(
        "CAPABILITY_FORBIDDEN",
        403,
        "reviewer_cannot_impersonate_ul",
      );
    return new ExecutiveRepository(db);
  }
  const inScope =
    principal.capabilities.includes("UNIT_EDIT_SCOPED") &&
    principal.unitScopes.some((scope) => scope.unitId === unitId);
  if (!inScope)
    throw new AuthError("RESOURCE_NOT_FOUND", 404, "review_not_visible");
  if (disposition && disposition !== "UL_RESPONSE")
    throw new AuthError(
      "CAPABILITY_FORBIDDEN",
      403,
      "review_action_not_allowed",
    );
  return new ExecutiveRepository(db);
}
