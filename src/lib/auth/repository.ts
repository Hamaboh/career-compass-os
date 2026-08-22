import type { AppUserIdentity, Role, UnitScope } from "./types";

export interface AppUserRepository {
  findCurrentBySubject(
    subject: string,
    now: Date,
  ): Promise<AppUserIdentity | null>;
}

type D1Row = {
  id: string;
  access_subject: string;
  email_normalized: string;
  display_name: string;
  status: AppUserIdentity["status"];
  role_code: Role | null;
  unit_id: string | null;
  valid_from: string | null;
  valid_to: string | null;
};

export class D1AppUserRepository implements AppUserRepository {
  constructor(private readonly db: Pick<D1Database, "prepare">) {}
  async findCurrentBySubject(
    subject: string,
    now: Date,
  ): Promise<AppUserIdentity | null> {
    const instant = now.toISOString();
    const result = await this.db
      .prepare(
        `SELECT u.id,u.access_subject,u.email_normalized,u.display_name,u.status,r.code role_code,s.unit_id,s.valid_from,s.valid_to
      FROM app_users u LEFT JOIN user_roles ur ON ur.user_id=u.id AND ur.valid_from<=? AND (ur.valid_to IS NULL OR ur.valid_to>?)
      LEFT JOIN roles r ON r.id=ur.role_id LEFT JOIN user_unit_scopes s ON s.user_id=u.id AND s.valid_from<=? AND (s.valid_to IS NULL OR s.valid_to>?)
      WHERE u.access_subject=?`,
      )
      .bind(instant, instant, instant, instant, subject)
      .all<D1Row>();
    if (!result.results.length) return null;
    const first = result.results[0]!;
    const unitScopes = new Map<string, UnitScope>();
    const roles = new Set<Role>();
    for (const row of result.results) {
      if (row.role_code) roles.add(row.role_code);
      if (row.unit_id && row.valid_from)
        unitScopes.set(row.unit_id, {
          unitId: row.unit_id,
          validFrom: row.valid_from,
          validTo: row.valid_to,
        });
    }
    return {
      id: first.id,
      accessSubject: first.access_subject,
      emailNormalized: first.email_normalized,
      displayName: first.display_name,
      status: first.status,
      roles: [...roles],
      unitScopes: [...unitScopes.values()],
    };
  }
}
