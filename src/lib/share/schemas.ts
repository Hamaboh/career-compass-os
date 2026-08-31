import { z } from "zod";

export const createSnapshotInput = z
  .object({
    idempotencyKey: z.string().trim().min(8).max(200),
  })
  .strict();

export const createTokenInput = z
  .object({
    version: z.number().int().positive(),
    expiresInDays: z.number().int().min(7).max(30).default(7),
    idempotencyKey: z.string().trim().min(8).max(200),
  })
  .strict();

export const revokeTokenInput = z
  .object({
    version: z.number().int().positive(),
  })
  .strict();

export const confirmationInput = z
  .object({
    version: z.number().int().positive(),
    method: z.enum(["IN_PERSON", "VIDEO", "PHONE"]),
    result: z.enum(["APPROVED", "CHANGES_REQUESTED", "ON_HOLD"]),
    memberWords: z.string().trim().min(1).max(2000),
    confirmedAt: z.iso.datetime(),
  })
  .strict();
