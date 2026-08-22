import type { AppEnvironment } from "../environment";
import { FakeAccessJwtVerifier } from "./fake-verifier";
import type { AccessJwtVerifier } from "./types";

export class AuthenticationConfigurationError extends Error {
  constructor() {
    super("Authentication is unavailable");
    this.name = "AuthenticationConfigurationError";
  }
}

export function createAccessJwtVerifier(
  environment: AppEnvironment,
): AccessJwtVerifier {
  if (environment.APP_ENV === "production" || environment.AUTH_MODE !== "fake")
    throw new AuthenticationConfigurationError();
  return new FakeAccessJwtVerifier(
    environment.ACCESS_ISSUER,
    environment.ACCESS_AUDIENCE,
  );
}
