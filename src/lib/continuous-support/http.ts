import type { Principal } from "../auth/types";
import { selfRead, selfWrite } from "../self-understanding/http";
import { ContinuousSupportRepository } from "./repository";

export async function supportRead(
  db: D1Database,
  principal: Principal,
  memberId: string,
  requestId: string,
) {
  await selfRead(db, principal, memberId, requestId);
  return new ContinuousSupportRepository(db).overview(principal, memberId);
}

export async function supportWrite(
  db: D1Database,
  principal: Principal,
  memberId: string,
  requestId: string,
  reason?: string,
) {
  await selfWrite(db, principal, memberId, requestId, reason);
  return new ContinuousSupportRepository(db);
}
