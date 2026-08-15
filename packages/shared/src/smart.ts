/**
 * <smart_guidance>/<smart_gate>。目標保存直前のSMART監査5項目それぞれの判定。
 * apps/api/prisma/schema.prisma の SmartAuditResult enumと値を一致させる。
 */
export const SMART_AUDIT_RESULTS = ['ok', 'needs_improvement', 'insufficient'] as const;
export type SmartAuditResult = (typeof SMART_AUDIT_RESULTS)[number];

/** SMART監査5項目のキー。Specific/Measurable/Achievable/Relevant/Time-bound。 */
export const SMART_CRITERIA = ['specific', 'measurable', 'achievable', 'relevant', 'timebound'] as const;
export type SmartCriterion = (typeof SMART_CRITERIA)[number];

/** 5項目すべてがokの場合のみ、追加の合理的理由なしで確定できる（<smart_gate>要件）。 */
export function isSmartAuditPassing(results: Partial<Record<SmartCriterion, SmartAuditResult>>): boolean {
  return SMART_CRITERIA.every((c) => results[c] === 'ok');
}
