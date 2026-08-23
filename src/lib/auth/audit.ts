export interface AuditEvent {
  eventType:
    | "ROLE_GRANTED"
    | "ROLE_REVOKED"
    | "UNIT_SCOPE_GRANTED"
    | "UNIT_SCOPE_REVOKED"
    | "APP_USER_ACTIVATED"
    | "APP_USER_DEACTIVATED"
    | "AUTHORIZATION_DENIED"
    | "MAINTENANCE_BYPASS"
    | "MEMBER_CREATED"
    | "MEMBER_UPDATED"
    | "MEMBER_UNIT_HISTORY_ADDED"
    | "MEMBER_STATUS_HISTORY_ADDED";
  occurredAt: string;
  actorId: string | null;
  targetType: string;
  targetId: string | null;
  outcome: "ALLOWED" | "DENIED" | "SUCCEEDED";
  reason: string;
  requestId: string;
  metadata?: Record<string, string | boolean | null>;
}
export interface AuditWriter {
  write(event: AuditEvent): Promise<void>;
}
export async function recordAccessChange(
  writer: AuditWriter,
  event: Omit<AuditEvent, "occurredAt" | "outcome"> & {
    eventType: Extract<
      AuditEvent["eventType"],
      | "ROLE_GRANTED"
      | "ROLE_REVOKED"
      | "UNIT_SCOPE_GRANTED"
      | "UNIT_SCOPE_REVOKED"
      | "APP_USER_ACTIVATED"
      | "APP_USER_DEACTIVATED"
    >;
  },
): Promise<void> {
  await writer.write({
    ...event,
    occurredAt: new Date().toISOString(),
    outcome: "SUCCEEDED",
  });
}
export class D1AuditWriter implements AuditWriter {
  constructor(private readonly db: Pick<D1Database, "prepare">) {}
  async write(event: AuditEvent): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO audit_events (id,event_type,occurred_at,actor_id,target_type,target_id,outcome,reason,request_id,metadata_json)
      VALUES (?,?,?,?,?,?,?,?,?,?)`,
      )
      .bind(
        crypto.randomUUID(),
        event.eventType,
        event.occurredAt,
        event.actorId,
        event.targetType,
        event.targetId,
        event.outcome,
        event.reason,
        event.requestId,
        JSON.stringify(event.metadata ?? {}),
      )
      .run();
  }
}
