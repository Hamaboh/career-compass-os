'use client';

import { Button } from '../ui/primitives';

/**
 * Phase4 6.2節「AIの推測を提示するときの型（最重要パターン）」。
 * AIが推測(ai_inferred)を提示するすべての箇所で、この共通カード型を使う。
 *   - 「✨AIの提案（参考）」という統一アイコン+ラベルをアプリ全体で1種類のみ使用する
 *     （23章「バッジ疲れ」対策として、他のバッジ意匠を増やさない）。
 *   - 断定形を使わず、必ず推測形の文言で表示する（呼び出し元がその通り渡す前提）。
 *   - 3択反応は必ず本人の明示操作。無反応のまま次に進めることは可能だが、
 *     それを「暗黙の承認」として扱わない（userApproved=falseのまま保持）。
 */
export function AiProposalCard({
  text,
  basis,
  onAgree,
  onSlightlyDifferent,
  onDisagree,
  pending,
  agreeLabel = 'その通り',
  disagreeLabel = '全然違う',
  slightlyLabel = '少し違う',
}: {
  text: string;
  basis?: string;
  onAgree?: () => void;
  onSlightlyDifferent?: () => void;
  onDisagree?: () => void;
  pending?: boolean;
  agreeLabel?: string;
  disagreeLabel?: string;
  slightlyLabel?: string;
}) {
  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50 p-4">
      <p className="mb-2 text-xs font-medium text-violet-700">✨ AIの提案（参考）</p>
      <p className="whitespace-pre-wrap text-sm text-slate-800">{text}</p>
      {basis && <p className="mt-2 text-xs text-slate-500">根拠: {basis}</p>}
      {(onAgree || onSlightlyDifferent || onDisagree) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {onAgree && (
            <Button variant="secondary" onClick={onAgree} disabled={pending}>
              {agreeLabel}
            </Button>
          )}
          {onSlightlyDifferent && (
            <Button variant="secondary" onClick={onSlightlyDifferent} disabled={pending}>
              {slightlyLabel}
            </Button>
          )}
          {onDisagree && (
            <Button variant="ghost" onClick={onDisagree} disabled={pending}>
              {disagreeLabel}
            </Button>
          )}
        </div>
      )}
      <p className="mt-2 text-[11px] text-violet-500">※AIによる参考指標です。断定的な評価ではありません。</p>
    </div>
  );
}
