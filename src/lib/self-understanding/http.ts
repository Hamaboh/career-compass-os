import type { Principal } from "../auth/types";
import { authorize } from "../auth/policy";
import { D1AuditWriter } from "../auth/audit";
import { SelfUnderstandingRepository } from "./repository";
import { MemberError } from "../member/errors";

export async function selfRead(
  db: D1Database,
  p: Principal,
  memberId: string,
  rid: string,
) {
  const repo = new SelfUnderstandingRepository(db),
    unit = await repo.memberUnit(p, memberId);
  if (!unit)
    throw new MemberError("RESOURCE_NOT_FOUND", 404, "member_not_visible");
  await authorize(
    p,
    {
      capability: p.globalUnitRead ? "UNIT_READ_ALL" : "UNIT_READ_SCOPED",
      resourceUnitId: unit,
      concealExistence: true,
      targetType: "self_understanding",
      targetId: memberId,
    },
    new D1AuditWriter(db),
    rid,
  );
  return repo.overview(p, memberId);
}
export async function selfWrite(
  db: D1Database,
  p: Principal,
  memberId: string,
  rid: string,
  reason?: string,
) {
  const repo = new SelfUnderstandingRepository(db),
    unit = await repo.memberUnit(p, memberId);
  if (!unit)
    throw new MemberError("RESOURCE_NOT_FOUND", 404, "member_not_visible");
  const capability =
    p.capabilities.includes("UNIT_EDIT_SCOPED") && !reason
      ? "UNIT_EDIT_SCOPED"
      : "BUSINESS_EDIT_MAINTENANCE";
  await authorize(
    p,
    {
      capability,
      resourceUnitId: unit,
      concealExistence: true,
      maintenanceReason: reason,
      targetType: "self_understanding",
      targetId: memberId,
    },
    new D1AuditWriter(db),
    rid,
  );
  return repo;
}
