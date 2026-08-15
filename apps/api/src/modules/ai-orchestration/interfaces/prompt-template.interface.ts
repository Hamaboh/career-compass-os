import type { ReservedAgentName } from '@career-compass/shared';

/**
 * Phase3 14章「AI Orchestration Service」。
 * すべてのAI呼び出しはこのテンプレート定義を経由する（プロンプトの唯一の集約場所）。
 */
export interface PromptTemplateDefinition<TContext = Record<string, unknown>, TOutput = unknown> {
  id: string;
  /** Phase2 FOUNDATION §0.6の予約エージェント名のいずれか。 */
  agentName: ReservedAgentName;
  description: string;
  systemPrompt: string;
  buildUserMessage: (context: TContext) => string;
  /** output_config.format用のJSON Schema（数値・文字列の範囲制約は構造化出力が非対応のため、
   * 範囲チェックはvalidateで実行時に行う）。 */
  responseSchema: Record<string, unknown>;
  maxTokens: number;
  /** AIレスポンスをJSON.parseした結果を検証し、期待した型に絞り込む。不正な形はここで例外を投げる。 */
  validate: (parsed: unknown) => TOutput;
}
