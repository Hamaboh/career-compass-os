import { z } from "zod";

export const id = z.string().uuid();
export const sessionInput = z
  .object({
    routeType: z.enum(["EXPLORE", "DIRECTION", "DIRECT_GOAL", "HOLD"]),
    status: z.enum(["ACTIVE", "ON_HOLD", "SKIPPED"]).default("ACTIVE"),
  })
  .strict();
const protection = {
  confidentiality: z.enum(["NORMAL", "CONFIDENTIAL"]),
  visibility: z.enum(["UL_AND_EXEC", "UL_ONLY"]),
  aiSendPolicy: z.enum(["AI_SEND_ALLOWED", "AI_SEND_PROHIBITED"]),
};
export const questionInput = z
  .object({
    domain: z.enum([
      "EXPERIENCE",
      "EMOTION",
      "STRENGTH",
      "VALUE",
      "LIFE",
      "CAREER",
      "FUTURE",
    ]),
    promptText: z.string().trim().min(1).max(500),
    position: z.number().int().positive(),
  })
  .strict();
export const questionUpdateInput = questionInput
  .extend({ questionId: id, version: z.number().int().positive() })
  .strict();
export const sessionTransitionInput = z
  .object({
    status: z.enum(["ACTIVE", "COMPLETED", "ON_HOLD", "SKIPPED"]),
    version: z.number().int().positive(),
  })
  .strict();
export const entryInput = z
  .object({
    entryId: id.optional(),
    questionId: id.nullable().optional(),
    responseStatus: z.enum([
      "UNANSWERED",
      "ANSWERED",
      "UNKNOWN",
      "DECLINED",
      "ON_HOLD",
      "SKIPPED",
    ]),
    responseText: z.string().trim().min(1).max(4000).nullable().optional(),
    provenanceType: z.enum([
      "MEMBER_STATEMENT",
      "UL_OBSERVATION",
      "AI_HYPOTHESIS",
      "MEMBER_CONFIRMED",
    ]),
    ...protection,
    version: z.number().int().positive().optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if ((v.version === undefined) !== (v.entryId === undefined))
      ctx.addIssue({
        code: "custom",
        path: ["entryId"],
        message: "編集時はentryIdとversionを両方指定してください",
      });
    if ((v.responseStatus === "ANSWERED") !== !!v.responseText)
      ctx.addIssue({
        code: "custom",
        path: ["responseText"],
        message: "回答済みだけ本文が必要です",
      });
    if (
      v.provenanceType === "MEMBER_CONFIRMED" &&
      v.responseStatus !== "ANSWERED"
    )
      ctx.addIssue({
        code: "custom",
        path: ["provenanceType"],
        message: "本人確認済み事実は回答済みとして記録してください",
      });
    if (
      v.confidentiality === "CONFIDENTIAL" &&
      (v.visibility !== "UL_ONLY" || v.aiSendPolicy !== "AI_SEND_PROHIBITED")
    )
      ctx.addIssue({
        code: "custom",
        path: ["confidentiality"],
        message: "機密はUL限定かつAI送信不可です",
      });
  });
export const entryCreateInput = entryInput.refine(
  (value) => value.entryId === undefined && value.version === undefined,
  { message: "新規作成にentryId/versionは指定できません" },
);
export const entryUpdateInput = entryInput.refine(
  (value) => value.entryId !== undefined && value.version !== undefined,
  { message: "編集にはentryId/versionが必要です" },
);
export const visionInput = z
  .object({
    kind: z.enum(["FUTURE_VISION", "VALUE", "CAREER_DIRECTION"]),
    statement: z.string().trim().min(1).max(2000),
    status: z.enum(["HYPOTHESIS", "MEMBER_CONFIRMED", "ON_HOLD"]),
    provenanceType: z.enum([
      "MEMBER_STATEMENT",
      "UL_OBSERVATION",
      "AI_HYPOTHESIS",
      "MEMBER_CONFIRMED",
    ]),
    evidenceEntryIds: z.array(id).max(20).default([]),
    ...protection,
    expectedVersion: z.number().int().nonnegative(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (
      (v.status === "MEMBER_CONFIRMED") !==
      (v.provenanceType === "MEMBER_CONFIRMED")
    )
      ctx.addIssue({
        code: "custom",
        path: ["provenanceType"],
        message: "確認済み状態と出所を一致させてください",
      });
    if (
      v.confidentiality === "CONFIDENTIAL" &&
      (v.visibility !== "UL_ONLY" || v.aiSendPolicy !== "AI_SEND_PROHIBITED")
    )
      ctx.addIssue({
        code: "custom",
        path: ["confidentiality"],
        message: "機密はUL限定かつAI送信不可です",
      });
  });
