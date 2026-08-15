import type { SelfAnalysisCategory } from '@career-compass/shared';

/**
 * Phase2 1.0節「初期セットを実装の出発点として固定する」の実装。
 * 12カテゴリ（HIDDEN_STRENGTHを除く）それぞれについて、depth=0（基本問）の質問文を
 * コード定数として固定する。深掘り問（depth>=1）はAIが直前の回答内容を踏まえて動的に
 * 生成する（self-analysis.followup-question.v1テンプレート）。
 */
export const BASE_QUESTIONS: Record<Exclude<SelfAnalysisCategory, 'HIDDEN_STRENGTH'>, string> = {
  PAST_EXPERIENCE: 'これまでの仕事の中で、特に印象に残っている経験を教えてください。',
  SUCCESS_ACHIEVEMENT: 'これまでで「うまくいった」「達成感があった」と感じた出来事は何ですか。',
  FAILURE_DISSATISFACTION: 'これまでの仕事で、うまくいかなかった・不満だったと感じた出来事はありますか。',
  WORK_JOY: 'どんな仕事をしているときに、やりがいや楽しさを感じますか。',
  WORK_PAIN: 'どんな仕事をしているときに、ストレスや苦痛を感じますか。',
  STRENGTH_WEAKNESS: '自分の強みだと思うところ、逆に弱みだと思うところを教えてください。',
  INTEREST_CONCERN: '最近、仕事やキャリアに関して興味を持っていること・気になっていることはありますか。',
  VALUES_NONNEGOTIABLE: '働くうえで、これだけは譲れないと思っていることは何ですか。',
  EXTERNAL_EVALUATION: '周囲の人（上司・同僚・顧客等）から、よく言われる評価やフィードバックはありますか。',
  SKILL_CURRENT_FUTURE: '今持っているスキルの中で自信があるものと、今後身につけたいスキルを教えてください。',
  WORKPLACE_CHALLENGE: '今のチームや職場環境で、難しさを感じていることはありますか。',
  IDEAL_STATE: '3〜5年後、どんな状態・立場になっていたいと思いますか。',
};

/** カテゴリの日本語表示ラベル（プロンプト・レスポンス用）。HIDDEN_STRENGTHはAI専用のため含む。 */
export const CATEGORY_LABELS: Record<SelfAnalysisCategory, string> = {
  PAST_EXPERIENCE: '過去の経験',
  SUCCESS_ACHIEVEMENT: '成功・達成体験',
  FAILURE_DISSATISFACTION: '失敗・不満体験',
  WORK_JOY: '仕事のやりがい',
  WORK_PAIN: '仕事の苦痛',
  STRENGTH_WEAKNESS: '強み・弱み',
  INTEREST_CONCERN: '興味・関心事',
  VALUES_NONNEGOTIABLE: '譲れない価値観',
  EXTERNAL_EVALUATION: '他者評価',
  SKILL_CURRENT_FUTURE: '現在・将来のスキル',
  WORKPLACE_CHALLENGE: '職場での難しさ',
  IDEAL_STATE: '理想の将来像',
  HIDDEN_STRENGTH: '自分では気づいていない強み',
} as Record<SelfAnalysisCategory, string>;
