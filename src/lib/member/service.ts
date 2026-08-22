import type { AuditWriter } from "../auth/audit";
import { authorize } from "../auth/policy";
import type { Principal } from "../auth/types";
import type { D1MemberRepository } from "./repository";
import type { MemberStatus } from "./types";
export class MemberService {
  constructor(
    private repo: D1MemberRepository,
    private audit: AuditWriter,
    private now = () => new Date(),
  ) {}
  async units(p: Principal, rid: string) {
    await authorize(
      p,
      {
        capability: p.globalUnitRead ? "UNIT_READ_ALL" : "UNIT_READ_SCOPED",
        targetType: "unit",
      },
      this.audit,
      rid,
    );
    return this.repo.listUnits(p);
  }
  async list(
    p: Principal,
    unit: string,
    cursor: string | undefined,
    limit: number,
    rid: string,
  ) {
    await authorize(
      p,
      {
        capability: p.globalUnitRead ? "UNIT_READ_ALL" : "UNIT_READ_SCOPED",
        resourceUnitId: unit,
        concealExistence: true,
        targetType: "unit",
        targetId: unit,
      },
      this.audit,
      rid,
    );
    return this.repo.listMembers(p, unit, cursor, limit);
  }
  async get(p: Principal, id: string, rid: string) {
    const m = await this.repo.findMember(p, id);
    if (!m) return this.notFound(p, id, rid);
    await authorize(
      p,
      {
        capability: p.globalUnitRead ? "UNIT_READ_ALL" : "UNIT_READ_SCOPED",
        resourceUnitId: m.primaryUnitId,
        concealExistence: true,
        targetType: "member",
        targetId: id,
      },
      this.audit,
      rid,
    );
    if (!p.capabilities.includes("UNIT_EDIT_SCOPED")) {
      const readOnlyView: Partial<typeof m> = { ...m };
      delete readOnlyView.employeeRef;
      return readOnlyView;
    }
    return m;
  }
  async create(
    p: Principal,
    unit: string,
    input: {
      employeeRef: string;
      displayName: string;
      joinedOn: string;
      primaryUnitStartedOn: string;
    },
    rid: string,
    maintenanceReason?: string,
  ) {
    const capability = this.writeCapability(p, maintenanceReason);
    await authorize(
      p,
      {
        capability,
        resourceUnitId: unit,
        concealExistence: true,
        maintenanceReason,
        targetType: "member",
      },
      this.audit,
      rid,
    );
    const m = await this.repo.createMember(
      p,
      input,
      unit,
      this.now().toISOString(),
    );
    await this.event("MEMBER_CREATED", p, m.id, rid);
    return m;
  }
  async patch(
    p: Principal,
    id: string,
    input: { displayName?: string; employeeRef?: string; version: number },
    rid: string,
    maintenanceReason?: string,
  ) {
    const current = await this.repo.findMember(p, id, true);
    if (!current) return this.notFound(p, id, rid);
    await authorize(
      p,
      {
        capability: this.writeCapability(p, maintenanceReason),
        resourceUnitId: current.primaryUnitId,
        concealExistence: true,
        maintenanceReason,
        targetType: "member",
        targetId: id,
      },
      this.audit,
      rid,
    );
    const m = await this.repo.updateMember(
      p,
      id,
      input,
      this.now().toISOString(),
    );
    await this.event("MEMBER_UPDATED", p, id, rid);
    return m;
  }
  async unitHistory(
    p: Principal,
    id: string,
    input: {
      unitId: string;
      isPrimary: boolean;
      startedOn: string;
      endedOn?: string | null;
      source: string;
      version: number;
    },
    rid: string,
    maintenanceReason?: string,
  ) {
    const current = await this.repo.findMember(p, id, true);
    if (!current) return this.notFound(p, id, rid);
    await authorize(
      p,
      {
        capability: this.writeCapability(p, maintenanceReason),
        resourceUnitId: current.primaryUnitId,
        concealExistence: true,
        maintenanceReason,
        targetType: "member",
        targetId: id,
      },
      this.audit,
      rid,
    );
    const m = await this.repo.addUnitHistory(
      p,
      id,
      input,
      this.now().toISOString(),
    );
    await this.event("MEMBER_UNIT_HISTORY_ADDED", p, id, rid);
    return m;
  }
  async statusHistory(
    p: Principal,
    id: string,
    input: {
      status: MemberStatus;
      startedOn: string;
      endedOn?: string | null;
      reasonCode: string;
      version: number;
    },
    rid: string,
    maintenanceReason?: string,
  ) {
    const current = await this.repo.findMember(p, id, true);
    if (!current) return this.notFound(p, id, rid);
    await authorize(
      p,
      {
        capability: this.writeCapability(p, maintenanceReason),
        resourceUnitId: current.primaryUnitId,
        concealExistence: true,
        maintenanceReason,
        targetType: "member",
        targetId: id,
      },
      this.audit,
      rid,
    );
    const m = await this.repo.addStatusHistory(
      p,
      id,
      input,
      this.now().toISOString(),
    );
    await this.event("MEMBER_STATUS_HISTORY_ADDED", p, id, rid);
    return m;
  }
  private writeCapability(p: Principal, reason?: string) {
    return p.capabilities.includes("UNIT_EDIT_SCOPED") && !reason
      ? ("UNIT_EDIT_SCOPED" as const)
      : ("BUSINESS_EDIT_MAINTENANCE" as const);
  }
  private async notFound(
    p: Principal,
    id: string,
    rid: string,
  ): Promise<never> {
    await authorize(
      p,
      {
        capability: "UNIT_READ_SCOPED",
        resourceUnitId: "__concealed__",
        concealExistence: true,
        targetType: "member",
        targetId: id,
      },
      this.audit,
      rid,
    );
    throw new Error("unreachable");
  }
  private event(
    eventType:
      | "MEMBER_CREATED"
      | "MEMBER_UPDATED"
      | "MEMBER_UNIT_HISTORY_ADDED"
      | "MEMBER_STATUS_HISTORY_ADDED",
    p: Principal,
    id: string,
    rid: string,
  ) {
    return this.audit.write({
      eventType,
      occurredAt: this.now().toISOString(),
      actorId: p.actorId,
      targetType: "member",
      targetId: id,
      outcome: "SUCCEEDED",
      reason: "operation_succeeded",
      requestId: rid,
    });
  }
}
