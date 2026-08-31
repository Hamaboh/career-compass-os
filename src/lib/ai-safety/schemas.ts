import { z } from "zod";

export const aiOperations = [
  "QUESTION_PLAN",
  "FUTURE_HYPOTHESIS",
  "WHY_EXPLORE",
  "GOAL_DRAFT",
  "SMART_AUDIT",
  "ACTION_PLAN",
  "ONE_ON_ONE_PREP",
  "ONE_ON_ONE_POST",
  "GOAL_CHANGE",
] as const;

export const inputRefTypes = [
  "GOAL_VERSION",
  "PROGRESS_ENTRY",
  "REFLECTION",
  "ACTION_ITEM",
  "ONE_ON_ONE_ENTRY",
] as const;

export const prepareInput = z
  .object({
    memberId: z.uuid(),
    operation: z.enum(aiOperations),
    purpose: z.string().trim().min(1).max(500),
    inputRefs: z
      .array(z.object({ type: z.enum(inputRefTypes), id: z.uuid() }).strict())
      .min(1)
      .max(20),
    idempotencyKey: z.string().trim().min(8).max(200),
  })
  .strict();

export const previewEditInput = z
  .object({
    version: z.number().int().positive(),
    sanitizedText: z.string().min(1).max(12000),
  })
  .strict();

export const requestVersionInput = z
  .object({ version: z.number().int().positive() })
  .strict();

export const suggestionDecisionInput = z
  .object({
    version: z.number().int().positive(),
    decision: z.enum(["ACCEPTED", "PARTIALLY_ACCEPTED", "REJECTED"]),
    editedContent: z.string().trim().min(1).max(4000).optional(),
    reason: z.string().trim().min(1).max(1000),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.decision === "PARTIALLY_ACCEPTED" && !value.editedContent)
      context.addIssue({
        code: "custom",
        path: ["editedContent"],
        message: "部分採用には人間が編集した内容が必要です",
      });
    if (value.decision === "REJECTED" && value.editedContent)
      context.addIssue({
        code: "custom",
        path: ["editedContent"],
        message: "却下時に採用内容は保存できません",
      });
  });

export type AiOperation = (typeof aiOperations)[number];
export type InputRef = z.infer<typeof prepareInput>["inputRefs"][number];
