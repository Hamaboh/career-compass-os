export type AuthErrorCode =
  | "AUTHENTICATION_REQUIRED"
  | "INVALID_ACCESS_TOKEN"
  | "APP_USER_FORBIDDEN"
  | "CAPABILITY_FORBIDDEN"
  | "RESOURCE_NOT_FOUND"
  | "MAINTENANCE_REASON_REQUIRED";

export class AuthError extends Error {
  constructor(
    readonly code: AuthErrorCode,
    readonly status: 401 | 403 | 404,
    readonly reason: string,
  ) {
    super(code);
    this.name = "AuthError";
  }
}
