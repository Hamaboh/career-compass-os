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

const globalUnitCapabilities = new Set<Capability>([
  "UNIT_READ_ALL",
  "REVIEW_ALL",
  "AUDIT_READ_ALL",
]);

export function capabilityAllowsGlobalUnitScope(
  capability: Capability,
): boolean {
  return globalUnitCapabilities.has(capability);
}

export function hasGlobalUnitAccess(capabilities: Capability[]): boolean {
  return capabilities.includes("UNIT_READ_ALL");
}
