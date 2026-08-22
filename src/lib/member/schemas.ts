import { z } from "zod";

export const idSchema = z.string().uuid();
const date = z.iso.date();
const bounded = z.string().trim().min(1).max(100);
export const cursorQuerySchema = z
  .object({
    cursor: idSchema.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();
export const createMemberSchema = z
  .object({
    employeeRef: bounded,
    displayName: bounded,
    joinedOn: date,
    primaryUnitStartedOn: date,
  })
  .strict();
export const patchMemberSchema = z
  .object({
    displayName: bounded.optional(),
    employeeRef: bounded.optional(),
    version: z.number().int().positive(),
  })
  .strict()
  .refine(
    (v) => v.displayName !== undefined || v.employeeRef !== undefined,
    "変更内容が必要です",
  );
export const unitHistorySchema = z
  .object({
    unitId: idSchema,
    isPrimary: z.boolean(),
    startedOn: date,
    endedOn: date.nullable().optional(),
    source: z.enum(["MANUAL", "IMPORT", "MAINTENANCE"]).default("MANUAL"),
    version: z.number().int().positive(),
  })
  .strict()
  .refine((v) => !v.endedOn || v.endedOn > v.startedOn, {
    path: ["endedOn"],
    message: "終了日は開始日より後にしてください",
  });
export const statusHistorySchema = z
  .object({
    status: z.enum(["ACTIVE", "ON_LEAVE", "LEFT", "OUT_OF_SCOPE"]),
    startedOn: date,
    endedOn: date.nullable().optional(),
    reasonCode: z.string().trim().min(1).max(50),
    version: z.number().int().positive(),
  })
  .strict()
  .refine((v) => !v.endedOn || v.endedOn > v.startedOn, {
    path: ["endedOn"],
    message: "終了日は開始日より後にしてください",
  });
