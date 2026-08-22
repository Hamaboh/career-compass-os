import type { Capability, Role } from "./types";

const roleCapabilities: Record<Role, readonly Capability[]> = {
  SYSTEM_ADMIN: [
    "PROFILE_READ",
    "UNIT_READ_ALL",
    "UNIT_READ_SCOPED",
    "BUSINESS_EDIT_MAINTENANCE",
    "REVIEW_ALL",
    "USER_ACCESS_MANAGE",
    "AUDIT_READ_ALL",
  ],
  EXECUTIVE: [
    "PROFILE_READ",
    "UNIT_READ_ALL",
    "UNIT_READ_SCOPED",
    "REVIEW_ALL",
  ],
  UL: ["PROFILE_READ", "UNIT_READ_SCOPED", "UNIT_EDIT_SCOPED"],
};

export function capabilitiesFor(roles: Role[]): Capability[] {
  return [...new Set(roles.flatMap((role) => roleCapabilities[role]))];
}
