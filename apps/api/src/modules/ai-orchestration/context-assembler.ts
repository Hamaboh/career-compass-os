import { isConfirmedFact, type SourcedField } from '@career-compass/shared';

/**
 * Phase3 14章 ContextAssembler。
 *
 * <ai_principles>「AIの推測とユーザーの明示的回答をデータ上分離する」の入力側の実装。
 * プロンプトに渡してよいデータを絞り込む唯一の関所とし、これ以外の場所で個別に
 * source/userApprovedを判定してプロンプトへの混入可否を決めるロジックを増やさない
 * （packages/shared の isConfirmedFact と対になる、Guardrail as codeの入力版）。
 *
 * user_stated、またはai_inferredでもuserApproved=trueの「確定事実」のみを通す。
 * 未承認のAI推測（例: 本人がまだ確認していない前回のインサイト仮説）を後続のAI呼び出しの
 * 前提として与えない。ただし「AIが自分自身の過去の仮説を再検討・改訂する」ユースケース
 * （例: 夢仮説の再探索）では、未承認の仮説そのものを明示的に扱う必要があるため、
 * その場合は呼び出し元がSourcedFieldでラップせず生データとして渡す（意図的な例外、
 * この関所を経由しないことをコード上明示する）。
 */
export const ContextAssembler = {
  /**
   * SourcedFieldでラップされたフィールド群から、確定事実のみを取り出す。
   * 未承認のai_inferredフィールドはキーごと出力から除外される。
   */
  assembleConfirmedFields<T extends Record<string, unknown>>(
    fields: Partial<Record<keyof T, SourcedField<unknown>>>,
  ): Partial<T> {
    const out: Partial<T> = {};
    for (const [key, field] of Object.entries(fields) as [keyof T, SourcedField<unknown> | undefined][]) {
      if (field && isConfirmedFact(field)) {
        out[key] = field.value as T[keyof T];
      }
    }
    return out;
  },
};
