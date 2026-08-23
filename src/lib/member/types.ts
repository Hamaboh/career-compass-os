export type MemberStatus = "ACTIVE" | "ON_LEAVE" | "LEFT" | "OUT_OF_SCOPE";
export interface UnitSummary {
  id: string;
  code: string;
  name: string;
  status: string;
  version: number;
}
export interface MemberSummary {
  id: string;
  displayName: string;
  status: MemberStatus;
  primaryUnitId: string;
  version: number;
  updatedAt: string;
}
export interface MemberDetail extends MemberSummary {
  employeeRef: string;
  joinedOn: string;
  leftOn: string | null;
  unitHistories: UnitHistory[];
  statusHistories: StatusHistory[];
}
export interface UnitHistory {
  id: string;
  unitId: string;
  isPrimary: boolean;
  startedOn: string;
  endedOn: string | null;
  source: string;
}
export interface StatusHistory {
  id: string;
  status: MemberStatus;
  startedOn: string;
  endedOn: string | null;
  reasonCode: string;
}
export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}
