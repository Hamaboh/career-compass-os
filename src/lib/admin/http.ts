import type { Principal } from "../auth/types";
import { MemberError } from "../member/errors";
import type { MemberRuntime } from "../member/http";
import { AdminRepository } from "./repository";

export function adminRepository(
  runtime: MemberRuntime,
  principal: Principal,
  capability:
    | "USER_ACCESS_MANAGE"
    | "AI_CONFIG_MANAGE"
    | "RETENTION_MANAGE"
    | "BACKUP_MANAGE"
    | "OPERATIONS_READ",
) {
  if (
    !principal.roles.includes("SYSTEM_ADMIN") ||
    !principal.capabilities.includes(capability)
  )
    throw new MemberError(
      "RESOURCE_NOT_FOUND",
      404,
      "admin_operation_not_visible",
    );
  if (!runtime.privateFiles)
    throw new MemberError(
      "DEPENDENCY_UNAVAILABLE",
      503,
      "private_operations_store_unavailable",
    );
  return new AdminRepository(runtime.db, runtime.privateFiles);
}

export function auditRepository(runtime: MemberRuntime, principal: Principal) {
  if (
    !principal.capabilities.includes("AUDIT_READ_ALL") &&
    !principal.capabilities.includes("AUDIT_READ_SCOPED")
  )
    throw new MemberError("RESOURCE_NOT_FOUND", 404, "audit_not_visible");
  if (!runtime.privateFiles)
    throw new MemberError(
      "DEPENDENCY_UNAVAILABLE",
      503,
      "private_operations_store_unavailable",
    );
  return new AdminRepository(runtime.db, runtime.privateFiles);
}
