/**
 * Phase2 FOUNDATION §0.6「予約エージェント名」。
 * 新しいAI機能を実装する際、この13種以外の新規エージェント名を作らない
 * （命名の氾濫を防ぎ、どの機能がどの絶対原則・境界ルールに従うかを追跡可能にする）。
 * 新しいエージェントが本当に必要な場合は、DB/APIモデルへの追加を伴うため
 * docs/DESIGN_FREEZE.md ルール2に従い実装前に報告する。
 */
export const RESERVED_AGENT_NAMES = [
  'SelfAnalysisAgent',
  'DreamExplorationAgent',
  'WhyEngine',
  'GoalStructuringAgent',
  'SmartGuidanceAgent',
  'SmartGateAgent',
  'InstitutionalConnectorAgent',
  'ConfidenceEstimator',
  'ProgressMonitor',
  'ReminderScheduler',
  'OneOnOneBriefAgent',
  'GoalRevisionAgent',
  'NextActionAgent',
] as const;

export type ReservedAgentName = (typeof RESERVED_AGENT_NAMES)[number];
