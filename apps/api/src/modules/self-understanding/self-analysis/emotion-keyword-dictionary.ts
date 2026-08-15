/**
 * Phase2 1.2節「EmotionKeywordDictionary」。
 * 「初期セットを実装の出発点として固定する」の方針どおり、可変長のDB設定テーブルではなく
 * コード定数として実装する（1〜10人規模のMVPでは、キーワード辞書を運用者が動的に編集する
 * 必要性は薄く、DB化はオーバーエンジニアリングと判断した。design freezeルール1の軽微な
 * 実装判断として明記する）。
 *
 * 回答本文への単純なキーワード一致で、AI分類を待たずに即座に感情強度の一次推定を行う
 * （同期）。この値は分岐判定（深掘りすべきか等）に即座に使われ、後続でAI分類
 * （self-analysis.answer-classify.v1、非同期相当）がより精緻な値で上書きする
 * （Phase2 1.2節「辞書マッチ(同期)とAI分類(非同期)の二重スコアリング」）。
 */
interface EmotionKeywordEntry {
  keywords: string[];
  weight: number; // 0-100スケールでの寄与度
}

const EMOTION_KEYWORD_ENTRIES: EmotionKeywordEntry[] = [
  { keywords: ['本当に', 'とても', '非常に', 'すごく', '心から'], weight: 20 },
  { keywords: ['嬉しい', '楽しい', 'やりがい', '達成感', '誇り'], weight: 30 },
  { keywords: ['辛い', 'つらい', '苦しい', 'ストレス', '不安', '悔しい'], weight: 35 },
  { keywords: ['絶対に', '二度と', '許せない', '限界'], weight: 40 },
  { keywords: ['泣', '涙', '怒り', '悲しい'], weight: 45 },
];

/** 回答テキストに対する辞書マッチのみでの一次スコア(0-100)。マッチなしは0。 */
export function dictionaryMatchEmotionIntensity(text: string): number {
  let score = 0;
  for (const entry of EMOTION_KEYWORD_ENTRIES) {
    if (entry.keywords.some((k) => text.includes(k))) {
      score += entry.weight;
    }
  }
  return Math.min(100, score);
}
