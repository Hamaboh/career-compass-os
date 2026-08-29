import { z } from "zod";
import { id } from "../self-understanding/schemas";

const smart = z.enum(["OK", "NEEDS_IMPROVEMENT", "MISSING"]);
const provenance = z.enum([
  "MEMBER_STATEMENT",
  "UL_OBSERVATION",
  "MEMBER_CONFIRMED",
]);
export const goalInput = z
  .object({
    parentGoalId: id.nullable().optional(),
    entryRoute: z.enum(["EXPLORE", "DIRECTION", "DIRECT_GOAL", "HOLD"]),
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(4000).default(""),
    targetDate: z.string().date().nullable().optional(),
    successCriteria: z.string().trim().max(2000).default(""),
    reviewCycle: z.string().trim().max(100).nullable().optional(),
    provenanceType: provenance.exclude(["MEMBER_CONFIRMED"]),
    confidentiality: z.enum(["NORMAL", "CONFIDENTIAL"]),
    visibility: z.enum(["UL_AND_EXEC", "UL_ONLY"]),
    aiSendPolicy: z.enum(["AI_SEND_ALLOWED", "AI_SEND_PROHIBITED"]),
    links: z
      .array(
        z.object({
          type: z.enum([
            "WHY",
            "FUTURE_VISION",
            "DREAM",
            "CAREER_DIRECTION",
            "KPI",
            "UNIT_LEADERS_MISSION",
          ]),
          referenceId: z.string().trim().min(1).max(200),
          relevanceNote: z.string().trim().max(1000).default(""),
        }),
      )
      .max(20)
      .default([]),
  })
  .strict()
  .superRefine((v, ctx) => {
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
export const finalizeInput = z
  .object({
    version: z.number().int().positive(),
    memberWords: z.string().trim().min(1).max(2000),
    method: z.enum(["IN_PERSON", "VIDEO", "PHONE"]),
    confirmedAt: z.string().datetime(),
    checks: z
      .array(z.boolean())
      .length(7)
      .refine((v) => v.every(Boolean)),
    smart: z.object({
      specific: smart,
      measurable: smart,
      achievable: smart,
      relevant: smart,
      timeBound: smart,
      reasons: z.record(z.string(), z.string().max(1000)),
      exceptionReason: z.string().trim().min(1).max(1000).nullable().optional(),
      alternativeReviewMethod: z
        .string()
        .trim()
        .min(1)
        .max(1000)
        .nullable()
        .optional(),
      exceptionReviewDate: z.string().date().nullable().optional(),
    }),
  })
  .strict()
  .superRefine((v, ctx) => {
    const incomplete = Object.entries(v.smart)
      .filter(([key]) =>
        [
          "specific",
          "measurable",
          "achievable",
          "relevant",
          "timeBound",
        ].includes(key),
      )
      .some(([, value]) => value !== "OK");
    if (
      incomplete &&
      (!v.smart.exceptionReason ||
        !v.smart.alternativeReviewMethod ||
        !v.smart.exceptionReviewDate)
    )
      ctx.addIssue({
        code: "custom",
        path: ["smart", "exceptionReason"],
        message:
          "SMART不足は補完するか、理由・代替確認方法・再確認日が必要です",
      });
  });
export const actionInput = z.object({
  version: z.number().int().positive(),
  title: z.string().trim().min(1).max(300),
  dueAt: z.string().datetime().nullable().optional(),
  expectedEvidence: z.string().trim().max(1000).nullable().optional(),
  provenanceType: provenance,
});
export const evidenceInput = z.object({
  version: z.number().int().positive(),
  actionId: id,
  kind: z.enum(["REFERENCE", "NOTE", "DELIVERABLE_METADATA"]),
  description: z.string().trim().min(1).max(2000),
  referenceUri: z.string().url().max(2000).nullable().optional(),
  occurredOn: z.string().date().nullable().optional(),
  verificationStatus: z.enum(["UNVERIFIED", "MEMBER_CONFIRMED", "UL_VERIFIED"]),
  provenanceType: provenance,
});
