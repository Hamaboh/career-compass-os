import { AuthError } from "./errors";
import type { AuditWriter } from "./audit";
import type { Capability, Principal } from "./types";
import { capabilityAllowsGlobalUnitScope } from "./capabilities";

export interface AuthorizationRequest {
  capability: Capability;
  resourceUnitId?: string;
  concealExistence?: boolean;
  confidentiality?: "NORMAL" | "CONFIDENTIAL";
  recordAclActorIds?: string[];
  resourceStateAllows?: boolean;
  maintenanceReason?: string;
  targetType: string;
  targetId?: string;
}

export async function authorize(
  principal: Principal,
  request: AuthorizationRequest,
  audit: AuditWriter,
  requestId: string,
): Promise<void> {
  const maintenanceOperation =
    request.capability === "BUSINESS_EDIT_MAINTENANCE";
  const capabilityAllowsUnitBypass =
    maintenanceOperation ||
    (principal.globalUnitRead &&
      capabilityAllowsGlobalUnitScope(request.capability));
  let denial: AuthError | undefined;
  if (!principal.capabilities.includes(request.capability))
    denial = new AuthError("CAPABILITY_FORBIDDEN", 403, "capability_missing");
  else if (
    request.resourceUnitId &&
    !capabilityAllowsUnitBypass &&
    !principal.unitScopes.some(
      (scope) => scope.unitId === request.resourceUnitId,
    )
  )
    denial = new AuthError(
      request.concealExistence ? "RESOURCE_NOT_FOUND" : "CAPABILITY_FORBIDDEN",
      request.concealExistence ? 404 : 403,
      "unit_scope_denied",
    );
  else if (
    request.confidentiality === "CONFIDENTIAL" &&
    !request.recordAclActorIds?.includes(principal.actorId)
  )
    denial = new AuthError("CAPABILITY_FORBIDDEN", 403, "record_acl_denied");
  else if (request.resourceStateAllows === false)
    denial = new AuthError(
      "CAPABILITY_FORBIDDEN",
      403,
      "resource_state_denied",
    );
  if (maintenanceOperation && !request.maintenanceReason?.trim())
    denial = new AuthError(
      "MAINTENANCE_REASON_REQUIRED",
      403,
      "maintenance_reason_required",
    );
  if (denial) {
    await audit.write({
      eventType: "AUTHORIZATION_DENIED",
      occurredAt: new Date().toISOString(),
      actorId: principal.actorId,
      targetType: request.targetType,
      targetId: request.targetId ?? null,
      outcome: "DENIED",
      reason: denial.reason,
      requestId,
    });
    throw denial;
  }
  if (maintenanceOperation)
    await audit.write({
      eventType: "MAINTENANCE_BYPASS",
      occurredAt: new Date().toISOString(),
      actorId: principal.actorId,
      targetType: request.targetType,
      targetId: request.targetId ?? null,
      outcome: "ALLOWED",
      reason: request.maintenanceReason!.trim(),
      requestId,
      metadata: { capability: request.capability },
    });
}

/** Repositories use this result in the SQL predicate; callers may not omit a Principal. */
export function repositoryUnitScope(principal: Principal): {
  global: boolean;
  unitIds: string[];
} {
  return {
    global: principal.globalUnitRead,
    unitIds: principal.unitScopes.map((scope) => scope.unitId),
  };
}
