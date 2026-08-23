import { z } from "zod";

export const idSchema = z.string().uuid();
const date = z.iso.date();
const bounded = z.string().trim().min(1).max(100);
export function todayInTokyo(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${value.year}-${value.month}-${value.day}`;
}
export const cursorQuerySchema = z
  .object({
    cursor: idSchema.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();
export const createMemberSchemaFor = (now = new Date()) =>
  z
    .object({
      employeeRef: bounded,
      displayName: bounded,
      joinedOn: date,
      primaryUnitStartedOn: date,
    })
    .strict()
    .superRefine((value, context) => {
      const today = todayInTokyo(now);
      if (value.joinedOn > today)
        context.addIssue({
          code: "custom",
          path: ["joinedOn"],
          message: "入社日は本日以前にしてください",
        });
      if (value.primaryUnitStartedOn > today)
        context.addIssue({
          code: "custom",
          path: ["primaryUnitStartedOn"],
          message: "主所属開始日は本日以前にしてください",
        });
      if (value.primaryUnitStartedOn < value.joinedOn)
        context.addIssue({
          code: "custom",
          path: ["primaryUnitStartedOn"],
          message: "主所属開始日は入社日以後にしてください",
        });
    });
export const createMemberSchema = createMemberSchemaFor();
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
export const statusHistorySchemaFor = (now = new Date()) =>
  z
    .object({
      status: z.enum(["ACTIVE", "ON_LEAVE", "LEFT", "OUT_OF_SCOPE"]),
      startedOn: date,
      endedOn: date.nullable().optional(),
      reasonCode: z.string().trim().min(1).max(50),
      version: z.number().int().positive(),
    })
    .strict()
    .superRefine((value, context) => {
      if (value.endedOn && value.endedOn <= value.startedOn)
        context.addIssue({
          code: "custom",
          path: ["endedOn"],
          message: "終了日は開始日より後にしてください",
        });
      if (value.startedOn > todayInTokyo(now))
        context.addIssue({
          code: "custom",
          path: ["startedOn"],
          message: "状態開始日は本日以前にしてください",
        });
    });
export const statusHistorySchema = statusHistorySchemaFor();
