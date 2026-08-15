/**
 * Phase3 5.B「会社制度資料」ドメインのうち、本フェーズ（ADM-06 人事評価制度管理）で
 * 新規実装する evaluation_period_master / competency_master / position_master の語彙。
 * kpi_master / ulm_master は既存実装済みのため対象外（InstitutionMasterStatus等を再利用）。
 */
export const EVALUATION_PERIOD_TYPES = ['quarter', 'half_year', 'fiscal_year', 'custom'] as const;
export type EvaluationPeriodType = (typeof EVALUATION_PERIOD_TYPES)[number];
