/**
 * Phase2 §7〜9「制度接続」。会社KPI/Unit Leaders MissionとLongTermGoal/Checkpointの
 * 側面接続（<company_alignment>: KPI/ULM→本人の成長→キャリア→Whyの接続確認を伴う）。
 * apps/api/prisma/schema.prisma の InstitutionConnectableType / InstitutionType /
 * RelevanceLabel enumと値を一致させる。
 */

/** InstitutionalConnectionが接続できる目標階層オブジェクト（FOUNDATION §0.1）。 */
export const INSTITUTION_CONNECTABLE_TYPES = ['long_term_goal', 'checkpoint'] as const;
export type InstitutionConnectableType = (typeof INSTITUTION_CONNECTABLE_TYPES)[number];

export const INSTITUTION_TYPES = ['kpi', 'ulm'] as const;
export type InstitutionType = (typeof INSTITUTION_TYPES)[number];

/**
 * FOUNDATION §0.4「心理指標の共通表示ルール」と同じ5段階の質的ラベル。
 * 生スコアは内部値のみに留め、外部にはこのラベルのみを公開する。
 */
export const RELEVANCE_LABELS = ['very_low', 'low', 'medium', 'high', 'very_high'] as const;
export type RelevanceLabel = (typeof RELEVANCE_LABELS)[number];
