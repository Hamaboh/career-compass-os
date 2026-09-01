import { z } from "zod";
import { roles } from "../auth/types";

const id = z.string().uuid();
const iso = z.string().datetime({ offset: true });
const reason = z.string().trim().min(1).max(1000);

export const userCreateInput = z
  .object({
    accessSubject: z.string().trim().min(1).max(200),
    email: z
      .string()
      .email()
      .max(320)
      .transform((value) => value.toLowerCase()),
    displayName: z.string().trim().min(1).max(100),
    status: z.enum(["ACTIVE", "SUSPENDED", "REVOKED"]),
    roles: z.array(z.enum(roles)).min(1),
    unitIds: z.array(id).max(50),
    reason,
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.roles.includes("UL") && value.unitIds.length === 0)
      ctx.addIssue({
        code: "custom",
        path: ["unitIds"],
        message: "ULには1つ以上のUnit scopeが必要です",
      });
  });

export const userAccessInput = z
  .object({
    version: z.number().int().positive(),
    status: z.enum(["ACTIVE", "SUSPENDED", "REVOKED"]),
    roles: z.array(z.enum(roles)).min(1),
    unitIds: z.array(id).max(50),
    reason,
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.roles.includes("UL") && value.unitIds.length === 0)
      ctx.addIssue({
        code: "custom",
        path: ["unitIds"],
        message: "ULには1つ以上のUnit scopeが必要です",
      });
  });

export const aiPolicyInput = z
  .object({
    version: z.number().int().positive(),
    enabled: z.boolean(),
    monthlyCapMicrounits: z.number().int().min(1).max(1_000_000_000),
    reason,
  })
  .strict();

export const incidentSwitchInput = z
  .object({
    version: z.number().int().positive(),
    maintenanceMode: z.boolean(),
    aiDisabled: z.boolean(),
    shareDisabled: z.boolean(),
    mailDisabled: z.boolean(),
    reason,
  })
  .strict();

export const retentionScanInput = z
  .object({ asOf: iso, idempotencyKey: z.string().trim().min(8).max(128) })
  .strict();

export const retentionApproveInput = z
  .object({
    version: z.number().int().positive(),
    previewHash: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

export const retentionExecuteInput = retentionApproveInput;

export const backupExportInput = z
  .object({
    environment: z.enum(["LOCAL", "PREVIEW"]),
    sourceTimestamp: iso,
    idempotencyKey: z.string().trim().min(8).max(128),
  })
  .strict();

export const restoreExerciseInput = z
  .object({
    environment: z.enum(["LOCAL", "PREVIEW"]),
    startedAt: iso,
    completedAt: iso,
    restoredArtifactChecksum: z.string().regex(/^[a-f0-9]{64}$/),
    restoredCounts: z.record(
      z.string().regex(/^[a-z][a-z0-9_]{0,63}$/),
      z.number().int().nonnegative(),
    ),
    authorizationSmokeVerified: z.boolean(),
    notes: z.string().trim().max(1000),
  })
  .strict()
  .refine((value) => value.completedAt >= value.startedAt, {
    path: ["completedAt"],
    message: "完了日時は開始日時以降にしてください",
  })
  .refine((value) => Object.keys(value.restoredCounts).length <= 100, {
    path: ["restoredCounts"],
    message: "復元件数は100 table以内にしてください",
  });

export const quotaInput = z
  .object({
    environment: z.enum(["LOCAL", "PREVIEW", "PRODUCTION"]),
    workersPercent: z.number().min(0).max(100),
    d1Percent: z.number().min(0).max(100),
    r2Percent: z.number().min(0).max(100),
    source: z.enum(["SYNTHETIC", "MANUAL_CLOUDFLARE"]),
  })
  .strict();

export const auditQueryInput = z
  .object({
    from: iso.optional(),
    to: iso.optional(),
    actorId: id.optional(),
    unitId: id.optional(),
    eventType: z.string().trim().max(100).optional(),
    subjectType: z.string().trim().max(100).optional(),
    outcome: z.enum(["ALLOWED", "DENIED", "SUCCEEDED"]).optional(),
    requestId: z.string().trim().max(128).optional(),
    cursor: z
      .string()
      .regex(/^[A-Za-z0-9_-]{8,512}$/)
      .optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict()
  .refine(
    (value) =>
      !value.from ||
      !value.to ||
      (new Date(value.to).getTime() >= new Date(value.from).getTime() &&
        new Date(value.to).getTime() - new Date(value.from).getTime() <=
          366 * 86_400_000),
    { path: ["to"], message: "検索期間は開始以降かつ366日以内にしてください" },
  );

export const auditExportInput = z
  .object({
    from: iso,
    to: iso,
    eventType: z.string().trim().max(100).optional(),
    outcome: z.enum(["ALLOWED", "DENIED", "SUCCEEDED"]).optional(),
    limit: z.coerce.number().int().min(1).max(1000).default(1000),
  })
  .strict()
  .refine(
    (value) =>
      new Date(value.to).getTime() >= new Date(value.from).getTime() &&
      new Date(value.to).getTime() - new Date(value.from).getTime() <=
        31 * 86_400_000,
    { path: ["to"], message: "export期間は31日以内にしてください" },
  );
