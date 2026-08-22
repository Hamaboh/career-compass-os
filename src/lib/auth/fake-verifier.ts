import { z } from "zod";
import { AuthError } from "./errors";
import type { AccessJwtVerifier, VerifiedAccessClaims } from "./types";

const headerSchema = z
  .object({
    alg: z.literal("RS256"),
    kid: z.string().min(1),
    typ: z.literal("JWT"),
  })
  .strict();
const payloadSchema = z
  .object({
    sub: z.string().min(1),
    email: z.string().optional(),
    iss: z.string(),
    aud: z.union([z.string(), z.array(z.string())]),
    exp: z.number().int(),
    nbf: z.number().int(),
    iat: z.number().int(),
    type: z.literal("app"),
  })
  .strict();

function decode(segment: string): unknown {
  return JSON.parse(Buffer.from(segment, "base64url").toString("utf8"));
}

export class FakeAccessJwtVerifier implements AccessJwtVerifier {
  constructor(
    private readonly expectedIssuer: string,
    private readonly expectedAudience: string,
    private readonly clockSkewSeconds = 30,
  ) {}

  async verify(token: string, now = new Date()): Promise<VerifiedAccessClaims> {
    try {
      const [encodedHeader, encodedPayload, signature, extra] =
        token.split(".");
      if (
        !encodedHeader ||
        !encodedPayload ||
        signature !== "synthetic" ||
        extra
      )
        throw new Error("shape");
      const header = headerSchema.parse(decode(encodedHeader));
      const payload = payloadSchema.parse(decode(encodedPayload));
      const audience = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
      const epoch = Math.floor(now.getTime() / 1000);
      if (
        payload.iss !== this.expectedIssuer ||
        !audience.includes(this.expectedAudience)
      )
        throw new Error("authority");
      if (
        payload.exp < epoch - this.clockSkewSeconds ||
        payload.nbf > epoch + this.clockSkewSeconds ||
        payload.iat > epoch + this.clockSkewSeconds
      )
        throw new Error("time");
      const emailNormalized = payload.email?.trim().toLowerCase();
      if (emailNormalized && !z.email().safeParse(emailNormalized).success)
        throw new Error("email");
      return {
        subject: payload.sub,
        ...(emailNormalized ? { emailNormalized } : {}),
        issuer: payload.iss,
        audience: this.expectedAudience,
        issuedAt: payload.iat,
        notBefore: payload.nbf,
        expiresAt: payload.exp,
        keyId: header.kid,
        algorithm: header.alg,
        tokenType: header.typ,
      };
    } catch {
      throw new AuthError("INVALID_ACCESS_TOKEN", 401, "access_token_invalid");
    }
  }
}

export function createSyntheticAccessToken(input: {
  subject: string;
  issuer: string;
  audience: string;
  now?: Date;
  email?: string;
  expiresInSeconds?: number;
  notBeforeOffsetSeconds?: number;
}): string {
  const epoch = Math.floor((input.now ?? new Date()).getTime() / 1000);
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "RS256", kid: "synthetic-key", typ: "JWT" })}.${encode(
    {
      sub: input.subject,
      ...(input.email ? { email: input.email } : {}),
      iss: input.issuer,
      aud: input.audience,
      iat: epoch,
      nbf: epoch + (input.notBeforeOffsetSeconds ?? 0),
      exp: epoch + (input.expiresInSeconds ?? 300),
      type: "app",
    },
  )}.synthetic`;
}
