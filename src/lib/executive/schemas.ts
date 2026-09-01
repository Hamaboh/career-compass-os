import { z } from "zod";
import { id } from "../self-understanding/schemas";

export const policyDocumentInput = z
  .object({
    type: z.enum(["INDIVIDUAL_EVALUATION", "UNIT_LEADERS_MISSION"]),
    sourceName: z.string().trim().min(1).max(200),
    sourceRef: z.string().trim().max(1000).default(""),
    owner: z.string().trim().min(1).max(200),
  })
  .strict();

const policyItem = z
  .object({
    category: z.string().trim().min(1).max(100),
    code: z.string().trim().min(1).max(100),
    title: z.string().trim().min(1).max(300),
    description: z.string().trim().max(6000).default(""),
    criteria: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();

export const policyVersionInput = z
  .object({
    documentVersion: z.number().int().positive(),
    versionNo: z.string().trim().min(1).max(50),
    effectiveFrom: z.string().date(),
    effectiveTo: z.string().date().nullable().optional(),
    status: z.enum(["DRAFT", "ACTIVE", "RETIRED"]),
    checksum: z.string().regex(/^[a-f0-9]{64}$/),
    items: z.array(policyItem).min(1).max(500),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.effectiveTo && value.effectiveTo < value.effectiveFrom)
      context.addIssue({
        code: "custom",
        path: ["effectiveTo"],
        message: "適用終了日は開始日以降です",
      });
  });

export const goalPolicyLinkInput = z
  .object({
    policyItemId: id,
    relevanceNote: z.string().trim().max(2000).default(""),
  })
  .strict();

export const reviewInput = z
  .object({
    targetType: z.enum([
      "GOAL_VERSION",
      "PROGRESS_ENTRY",
      "REFLECTION",
      "ONE_ON_ONE_ENTRY",
    ]),
    targetId: id,
    unitId: id,
    assignedTo: id.nullable().optional(),
    revisionNo: z.number().int().positive(),
  })
  .strict();

export const reviewCommentInput = z
  .object({
    version: z.number().int().positive(),
    disposition: z.enum(["COMMENT", "RETURN", "CONFIRM", "UL_RESPONSE"]),
    body: z.string().trim().min(1).max(4000),
  })
  .strict();

export const turnoverInput = z
  .object({
    periodStart: z.string().date(),
    periodEnd: z.string().date(),
  })
  .strict()
  .refine((v) => v.periodEnd >= v.periodStart, {
    path: ["periodEnd"],
    message: "期間終了日は開始日以降です",
  });

export const businessDayInput = z
  .object({
    targetMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  })
  .strict();

export const holidayCalendarInput = z
  .object({
    year: z.number().int().min(2000).max(2200),
    versionNo: z.string().trim().min(1).max(50),
    status: z.enum(["DRAFT", "ACTIVE", "RETIRED"]),
    checksum: z.string().regex(/^[a-f0-9]{64}$/),
    holidays: z
      .array(
        z
          .object({
            date: z.string().date(),
            name: z.string().trim().min(1).max(200),
          })
          .strict(),
      )
      .max(400),
  })
  .strict()
  .superRefine((value, context) => {
    const dates = new Set<string>();
    value.holidays.forEach((holiday, index) => {
      if (!holiday.date.startsWith(`${value.year}-`))
        context.addIssue({
          code: "custom",
          path: ["holidays", index, "date"],
          message: "祝日はcalendarの対象年と一致させてください",
        });
      if (dates.has(holiday.date))
        context.addIssue({
          code: "custom",
          path: ["holidays", index, "date"],
          message: "同じ祝日を重複登録できません",
        });
      dates.add(holiday.date);
    });
  });

export const responseWindowInput = z
  .object({
    contactAt: z.string().datetime(),
    responseAt: z.string().datetime().nullable(),
    referenceAt: z.string().datetime(),
  })
  .strict();
