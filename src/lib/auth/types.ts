export const roles = ["SYSTEM_ADMIN", "EXECUTIVE", "UL"] as const;
export type Role = (typeof roles)[number];

export const capabilities = [
  "PROFILE_READ",
  "UNIT_READ_ALL",
  "UNIT_READ_SCOPED",
  "UNIT_EDIT_SCOPED",
  "BUSINESS_EDIT_MAINTENANCE",
  "REVIEW_ALL",
  "USER_ACCESS_MANAGE",
  "AUDIT_READ_ALL",
] as const;
export type Capability = (typeof capabilities)[number];
export type AppUserStatus = "ACTIVE" | "SUSPENDED" | "REVOKED";

export interface VerifiedAccessClaims {
  subject: string;
  emailNormalized?: string;
  issuer: string;
  audience: string;
  issuedAt: number;
  notBefore: number;
  expiresAt: number;
  keyId: string;
  algorithm: "RS256";
  tokenType: "JWT";
}

export interface AccessJwtVerifier {
  verify(token: string, now?: Date): Promise<VerifiedAccessClaims>;
}

export interface UnitScope {
  unitId: string;
  validFrom: string;
  validTo: string | null;
}

export interface Principal {
  actorId: string;
  accessSubject: string;
  status: "ACTIVE";
  roles: Role[];
  capabilities: Capability[];
  unitScopes: UnitScope[];
  globalUnitRead: boolean;
  createdAt: string;
}

export interface AppUserIdentity {
  id: string;
  accessSubject: string;
  emailNormalized: string;
  displayName: string;
  status: AppUserStatus;
  roles: Role[];
  unitScopes: UnitScope[];
}
