import { z } from "zod";
import { id } from "../self-understanding/schemas";

const provenance = z.enum([
  "MEMBER_STATEMENT",
  "MEMBER_CONFIRMED",
  "UL_OBSERVATION",
]);
const protectedFields = {
  provenanceType: provenance,
  confidentiality: z.enum(["NORMAL", "CONFIDENTIAL"]),
  aiSendPolicy: z.enum(["AI_SEND_ALLOWED", "AI_SEND_PROHIBITED"]),
};
function requireProtectedBoundary(
  value: { confidentiality: string; aiSendPolicy: string },
  context: z.RefinementCtx,
) {
  if (
    value.confidentiality === "CONFIDENTIAL" &&
    value.aiSendPolicy !== "AI_SEND_PROHIBITED"
  )
    context.addIssue({
      code: "custom",
      path: ["aiSendPolicy"],
      message: "機密記録はAI送信不可です",
    });
}

export const progressInput = z
  .object({
    ...protectedFields,
    version: z.number().int().positive(),
    state: z.enum([
      "NOT_STARTED",
      "IN_PROGRESS",
      "PAUSED",
      "COMPLETED",
      "CANCELLED",
    ]),
    percent: z.number().int().min(0).max(100).nullable().optional(),
    selfRating: z.number().int().min(0).max(100).nullable().optional(),
    note: z.string().trim().max(4000).default(""),
    blocker: z.string().trim().max(2000).default(""),
    nextCheckAt: z.string().datetime().nullable().optional(),
  })
  .strict()
  .superRefine(requireProtectedBoundary);

export const reflectionInput = z
  .object({
    ...protectedFields,
    version: z.number().int().positive(),
    periodStart: z.string().date(),
    periodEnd: z.string().date(),
    outcome: z.string().trim().max(4000).default(""),
    learning: z.string().trim().max(4000).default(""),
    feeling: z.string().trim().max(2000).default(""),
    nextChoice: z.enum([
      "CONTINUE",
      "REST",
      "EXPLORE",
      "NEXT_MILESTONE",
      "REVISE",
      "HOLD",
    ]),
  })
  .strict()
  .superRefine((value, context) => {
    requireProtectedBoundary(value, context);
    if (value.periodEnd < value.periodStart)
      context.addIssue({
        code: "custom",
        path: ["periodEnd"],
        message: "終了日は開始日以降にしてください",
      });
  });

export const indicatorInput = z
  .object({
    version: z.number().int().positive(),
    metricType: z.enum([
      "WHY_SATISFACTION",
      "GOAL_SATISFACTION",
      "DREAM_CONFIDENCE",
      "SMART_QUALITY",
      "ACHIEVABILITY",
      "CURRENT_PROGRESS",
      "MEMBER_SELF_RATING",
    ]),
    value: z.number().int().min(0).max(100),
    sourceType: z.enum(["MEMBER_SELF_REPORT", "UL_REFERENCE", "AI_REFERENCE"]),
    basisNote: z.string().trim().max(2000).default(""),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.metricType !== "SMART_QUALITY" &&
      value.sourceType !== "MEMBER_SELF_REPORT"
    )
      context.addIssue({
        code: "custom",
        path: ["sourceType"],
        message: "本人指標は本人の自己申告としてのみ記録できます",
      });
  });

export const oneOnOneInput = z
  .object({
    scheduledAt: z.string().datetime(),
    theme: z.string().trim().max(1000).default(""),
    nextAt: z.string().datetime().nullable().optional(),
  })
  .strict();
export const oneOnOneUpdateInput = z
  .object({
    version: z.number().int().positive(),
    status: z.enum(["SCHEDULED", "HELD", "CANCELLED", "NEEDS_FOLLOW_UP"]),
    heldAt: z.string().datetime().nullable().optional(),
    nextAt: z.string().datetime().nullable().optional(),
    theme: z.string().trim().max(1000),
  })
  .strict();
export const oneOnOneEntryInput = z
  .object({
    ...protectedFields,
    version: z.number().int().positive(),
    goalVersionId: id.nullable().optional(),
    entryType: z.enum([
      "MEMBER_STATEMENT",
      "UL_OBSERVATION",
      "AGREEMENT",
      "UNCONFIRMED",
      "NEXT_ACTION",
      "UL_SUPPORT",
      "RAW_NOTE",
    ]),
    body: z.string().trim().min(1).max(6000),
    confirmedWithMember: z.boolean().default(false),
    confirmationMethod: z
      .enum(["IN_PERSON", "VIDEO", "PHONE", "OTHER"])
      .nullable()
      .optional(),
    confirmedAt: z.string().datetime().nullable().optional(),
    memberConfirmationWords: z
      .string()
      .trim()
      .min(1)
      .max(2000)
      .nullable()
      .optional(),
  })
  .strict()
  .superRefine((value, context) => {
    requireProtectedBoundary(value, context);
    if (
      value.confirmedWithMember &&
      value.provenanceType !== "MEMBER_CONFIRMED"
    )
      context.addIssue({
        code: "custom",
        path: ["provenanceType"],
        message: "本人合意済みは本人確認済みの出所が必要です",
      });
    const confirmationComplete =
      value.confirmationMethod &&
      value.confirmedAt &&
      value.memberConfirmationWords;
    const hasConfirmationData =
      value.confirmationMethod != null ||
      value.confirmedAt != null ||
      value.memberConfirmationWords != null;
    if (value.confirmedWithMember && !confirmationComplete)
      context.addIssue({
        code: "custom",
        path: ["confirmedWithMember"],
        message: "本人確認には方法、日時、本人の言葉が必要です",
      });
    if (!value.confirmedWithMember && hasConfirmationData)
      context.addIssue({
        code: "custom",
        path: ["confirmedWithMember"],
        message: "本人未確認の記録へ確認証跡は保存できません",
      });
  });

export const reminderInput = z
  .object({
    subjectType: z.enum(["GOAL", "ACTION", "ONE_ON_ONE"]),
    subjectId: id,
    reminderType: z.enum([
      "ACTION_DUE",
      "MIDPOINT_CHECK",
      "REFLECTION",
      "ONE_ON_ONE",
      "SMART_RECHECK",
      "GOAL_DUE",
      "GOAL_UPDATE",
      "UNANSWERED",
    ]),
    cadenceDays: z.number().int().min(1).max(365).nullable().optional(),
    nextRunAt: z.string().datetime(),
    graceMinutes: z.number().int().min(0).max(43200).default(0),
    stopOnCompletion: z.boolean().default(true),
  })
  .strict()
  .superRefine((value, context) => {
    const compatible =
      (value.subjectType === "ACTION" && value.reminderType === "ACTION_DUE") ||
      (value.subjectType === "ONE_ON_ONE" &&
        ["ONE_ON_ONE", "UNANSWERED"].includes(value.reminderType)) ||
      (value.subjectType === "GOAL" &&
        [
          "MIDPOINT_CHECK",
          "REFLECTION",
          "SMART_RECHECK",
          "GOAL_DUE",
          "GOAL_UPDATE",
          "UNANSWERED",
        ].includes(value.reminderType));
    if (!compatible)
      context.addIssue({
        code: "custom",
        path: ["reminderType"],
        message: "対象とリマインダー種別が一致しません",
      });
  });
export const reminderUpdateInput = z
  .object({
    version: z.number().int().positive(),
    nextRunAt: z.string().datetime(),
    cadenceDays: z.number().int().min(1).max(365).nullable().optional(),
    graceMinutes: z.number().int().min(0).max(43200),
    enabled: z.boolean(),
    stopOnCompletion: z.boolean(),
  })
  .strict();
export const suggestionInput = z
  .object({ version: z.number().int().positive() })
  .strict();
export const notificationRunInput = z.object({}).strict();
