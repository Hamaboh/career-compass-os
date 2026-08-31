import { z } from "zod";
import type { AiOperation, InputRef } from "./schemas";

const responseSchema = z.object({
  status: z.literal("PROPOSAL"),
  factsUsed: z
    .array(z.object({ sourceRef: z.string(), statement: z.string().max(300) }))
    .max(20),
  unknowns: z.array(z.string().max(300)).max(10),
  questions: z.array(z.string().max(300)).max(10),
  suggestions: z
    .array(
      z.object({
        type: z.string().max(80),
        content: z.string().min(1).max(1000),
        rationale: z.string().min(1).max(1000),
        sourceRefs: z.array(z.string()),
      }),
    )
    .min(1)
    .max(6),
  warnings: z.array(z.string().max(300)).max(10),
  confidenceNote: z.string().max(500),
  schemaVersion: z.literal("1"),
  usage: z.object({
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
    costMicrounits: z.number().int().nonnegative(),
  }),
});
export type ValidatedAiResponse = z.infer<typeof responseSchema>;

const suggestionCopy: Record<AiOperation, [string, string, string]> = {
  QUESTION_PLAN: [
    "NEXT_QUESTION",
    "次回は、本人が今もっとも確かめたい点を質問候補として確認してください。",
    "入力だけでは優先順位を断定できないためです。",
  ],
  FUTURE_HYPOTHESIS: [
    "FUTURE_HYPOTHESIS",
    "将来像の仮説を本人の言葉で検討する候補です。",
    "仮説であり、本人の選択や確定を代行しません。",
  ],
  WHY_EXPLORE: [
    "WHY_CANDIDATE",
    "この目標を大切に感じる理由を本人へ確認する候補です。",
    "Whyは本人の言葉による確認が必要です。",
  ],
  GOAL_DRAFT: [
    "GOAL_DRAFT",
    "目的・期限・確認方法を含む目標草案を対話で編集してください。",
    "草案であり、本人確認前に確定しません。",
  ],
  SMART_AUDIT: [
    "SMART_CHECK",
    "SMART各軸の不足情報を質問で再確認してください。",
    "品質の参考であり、本人の能力評価ではありません。",
  ],
  ACTION_PLAN: [
    "NEXT_ACTION",
    "小さな次の行動と確認日を本人と相談してください。",
    "実行可能性は本人とULが決めます。",
  ],
  ONE_ON_ONE_PREP: [
    "ONE_ON_ONE_QUESTION",
    "直近の変化と支援してほしいことを質問候補にしてください。",
    "未入力を停滞や低意欲とは解釈しません。",
  ],
  ONE_ON_ONE_POST: [
    "UNCONFIRMED_SUMMARY",
    "決定事項と未確認事項を分けて原文と照合してください。",
    "AI整理案を本人発言へ上書きしません。",
  ],
  GOAL_CHANGE: [
    "GOAL_CHANGE_DRAFT",
    "継続・修正・保留の選択肢と影響を本人へ提示してください。",
    "現行revisionを変更せず、本人確認後に新版化します。",
  ],
};

export function deterministicFakeResponse(
  operation: AiOperation,
  refs: InputRef[],
  sanitizedText: string,
): unknown {
  const [type, content, rationale] = suggestionCopy[operation];
  const sourceRefs = refs.map((ref) => `${ref.type}:${ref.id}`);
  return {
    status: "PROPOSAL",
    factsUsed: sourceRefs.map((sourceRef) => ({
      sourceRef,
      statement: "入力スナップショット内の人間由来記録を参照",
    })),
    unknowns: ["本人が現在どの選択肢を望むかは未確認です。"],
    questions: ["この候補について、本人はどのように感じていますか。"],
    suggestions: [{ type, content, rationale, sourceRefs }],
    warnings: ["AI提案です。人事評価や本人確認を代行しません。"],
    confidenceNote:
      "入力スナップショットの根拠充足に関する参考です。本人の心理・能力・達成確率を示しません。",
    schemaVersion: "1",
    usage: {
      inputTokens: Math.ceil(sanitizedText.length / 4),
      outputTokens: 120,
      costMicrounits: 0,
    },
  };
}

const forbiddenJudgment =
  /低意欲|能力が低|退職(?:する|しそう)|昇進させ|降格|人事評価を確定|診断/i;
const pii =
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b|(?:\+?\d[\d\s()-]{8,}\d)/i;

export function validateFakeResponse(value: unknown, allowedRefs: InputRef[]) {
  const parsed = responseSchema.parse(value);
  const allowed = new Set(allowedRefs.map((ref) => `${ref.type}:${ref.id}`));
  for (const fact of parsed.factsUsed)
    if (!allowed.has(fact.sourceRef))
      throw new Error("UNSUPPORTED_FACT_REFERENCE");
  for (const suggestion of parsed.suggestions) {
    if (suggestion.sourceRefs.some((ref) => !allowed.has(ref)))
      throw new Error("UNSUPPORTED_FACT_REFERENCE");
    if (
      forbiddenJudgment.test(`${suggestion.content}\n${suggestion.rationale}`)
    )
      throw new Error("FORBIDDEN_JUDGMENT");
    if (pii.test(`${suggestion.content}\n${suggestion.rationale}`))
      throw new Error("PII_IN_RESPONSE");
  }
  return parsed;
}
