/**
 * Phase2 FOUNDATION §0.3「Source distinction rule（AI推測と事実の区別）」
 * および Phase3 14章のDBレベル強制の型表現。
 *
 * すべてのAI生成コンテンツは source: 'user_stated'（本人が明示した内容そのもの）または
 * source: 'ai_inferred'（AIが推測・要約した内容）のいずれかを持つ。
 * 'ai_inferred' の内容は、本人が確認して userApproved: true にするまで、
 * 他のロジック（SMARTゲート判定、KPI接続判断、1on1準備シート等）から
 * 「確定した事実」として扱ってはならない（Phase2絶対原則、Phase3 14.2/14.3節でDB権限として強制）。
 *
 * 実装ルール:
 *   - 同一レコード・同一カラムに複数sourceを混在させない。
 *   - バージョニングされるフィールドは1バージョン=1sourceとする。
 *   - `source: 'ai_inferred'` かつ `userApproved: false` のデータは、
 *     確定系のAPIレスポンス・確定系ロジックの入力として参照可能にしない
 *     （Phase4 23.6 A1の指摘: UI上も「仮」であることを常設表示する）。
 */
export const CONTENT_SOURCES = ['user_stated', 'ai_inferred'] as const;
export type ContentSource = (typeof CONTENT_SOURCES)[number];

export interface SourcedField<T> {
  value: T;
  source: ContentSource;
  /** source='ai_inferred' の場合のみ意味を持つ。user_statedは常にtrue相当として扱う。 */
  userApproved: boolean;
}

/**
 * ある SourcedField を「確定事実」として下流ロジックに渡してよいかどうかの判定。
 * Phase2絶対原則のアプリケーションコード上の単一の関所として、これ以外の場所で
 * source/userApprovedを独自に判定するロジックを増やさない（Guardrail as code）。
 */
export function isConfirmedFact<T>(field: SourcedField<T>): boolean {
  return field.source === 'user_stated' || (field.source === 'ai_inferred' && field.userApproved);
}
