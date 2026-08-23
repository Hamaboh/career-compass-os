import type { Capability, UnitScope } from "../auth/types";

export interface MemberUiPrincipal {
  capabilities: Capability[];
  unitScopes: UnitScope[];
}

export function canEditMember(
  principal: MemberUiPrincipal | null,
  primaryUnitId: string,
): boolean {
  return Boolean(
    principal?.capabilities.includes("UNIT_EDIT_SCOPED") &&
      principal.unitScopes.some((scope) => scope.unitId === primaryUnitId),
  );
}

export function memberPageUrl(unitId: string, cursor: string | null): string {
  const base = `/api/v1/units/${encodeURIComponent(unitId)}/members`;
  return cursor ? `${base}?cursor=${encodeURIComponent(cursor)}` : base;
}
