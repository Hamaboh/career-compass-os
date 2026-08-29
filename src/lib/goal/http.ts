import type { Principal } from "../auth/types";
import { selfRead, selfWrite } from "../self-understanding/http";
import { GoalRepository } from "./repository";
export async function goalRead(
  db: D1Database,
  p: Principal,
  memberId: string,
  rid: string,
) {
  await selfRead(db, p, memberId, rid);
  return new GoalRepository(db).list(p, memberId);
}
export async function goalWrite(
  db: D1Database,
  p: Principal,
  memberId: string,
  rid: string,
  reason?: string,
) {
  await selfWrite(db, p, memberId, rid, reason);
  return new GoalRepository(db);
}
