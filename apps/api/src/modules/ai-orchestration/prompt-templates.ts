import { INSIGHT_TYPES, type InsightType } from '@career-compass/shared';
import type { PromptTemplateDefinition } from './interfaces/prompt-template.interface';
import {
  assertArray,
  assertBoolean,
  assertEnum,
  assertNumberInRange,
  assertOptionalString,
  assertRecord,
  assertString,
  assertStringArray,
} from './response-validator';

/**
 * Phase3 14章「唯一のAI呼び出し経路」。実際にClaudeへ送るプロンプトはすべてこのファイルに
 * 集約する（散在させない）。各テンプレートの出力はoutput_config.format（構造化出力）で
 * JSON Schemaに拘束したうえ、responseValidator.tsのassert*で最終検証する。
 *
 * 全テンプレート共通の原則（<ai_principles>の実装）:
 *   - システムプロンプトには必ず「あなたは最終判断をしない。仮説・質問・候補の提示に徹する」
 *     という境界を明記する。
 *   - 出力はすべてsource='ai_inferred'として永続化される前提（PersistenceBoundaryは
 *     各ドメインServiceの責務、本ファイルはプロンプト定義のみ）。
 */

// ---------------------------------------------------------------------------
// 1. 自己分析: 深掘り質問生成（Phase2 1.1節 SelfAnalysisAgent）
// ---------------------------------------------------------------------------

export interface FollowupQuestionContext {
  categoryLabel: string;
  previousQuestion: string;
  previousAnswer: string;
  depthLevel: number;
}
export interface FollowupQuestionOutput {
  question: string;
}

const selfAnalysisFollowupQuestion: PromptTemplateDefinition<FollowupQuestionContext, FollowupQuestionOutput> = {
  id: 'self-analysis.followup-question.v1',
  agentName: 'SelfAnalysisAgent',
  description: '自己分析の回答内容に基づき、次の深掘り質問を1つ生成する。',
  systemPrompt: [
    'あなたは社員の自己分析を支援するコーチです。あなたの役割は「問いを立てること」だけであり、',
    '本人の代わりに強み・価値観・キャリアの結論を決めることは絶対にありません。',
    '直前の回答を踏まえ、本人がまだ言葉にしていない具体的な経験・感情・理由を引き出す',
    '深掘り質問を1つだけ日本語で生成してください。詰問調にならないよう、共感的かつ簡潔な',
    '一文にしてください。',
  ].join('\n'),
  buildUserMessage: (ctx) =>
    [
      `カテゴリ: ${ctx.categoryLabel}`,
      `深掘りの段階: ${ctx.depthLevel}`,
      `直前の質問: ${ctx.previousQuestion}`,
      `本人の回答: ${ctx.previousAnswer}`,
      '',
      'この回答をさらに深掘りする質問を1つ生成してください。',
    ].join('\n'),
  responseSchema: {
    type: 'object',
    properties: { question: { type: 'string', description: '次に本人へ投げかける深掘り質問（日本語、1文）' } },
    required: ['question'],
    additionalProperties: false,
  },
  maxTokens: 512,
  validate: (parsed) => {
    const obj = assertRecord(parsed, 'root');
    return { question: assertString(obj.question, 'question') };
  },
};

// ---------------------------------------------------------------------------
// 2. 自己分析: 回答の非同期分類（emotion_intensity_internal / topic_tags、Phase2 1.2節）
// ---------------------------------------------------------------------------

export interface AnswerClassifyContext {
  categoryLabel: string;
  answerText: string;
}
export interface AnswerClassifyOutput {
  emotionIntensity: number;
  topicTags: string[];
}

const selfAnalysisAnswerClassify: PromptTemplateDefinition<AnswerClassifyContext, AnswerClassifyOutput> = {
  id: 'self-analysis.answer-classify.v1',
  agentName: 'SelfAnalysisAgent',
  description: '自己分析の回答から、内部制御専用の感情強度と話題タグを抽出する（本人・他者には非公開）。',
  systemPrompt: [
    'あなたは自己分析の回答テキストを分析するアシスタントです。この分析結果は本人にもUL/Adminにも',
    '一切開示されない、後続の質問分岐ロジックのための内部制御値です。回答者の感情の強さを',
    '0(平静)〜100(非常に強い)のスコアで、話題のキーワードを短いタグの配列で抽出してください。',
  ].join('\n'),
  buildUserMessage: (ctx) =>
    [`カテゴリ: ${ctx.categoryLabel}`, `回答: ${ctx.answerText}`, '', '感情強度スコアと話題タグを抽出してください。'].join(
      '\n',
    ),
  responseSchema: {
    type: 'object',
    properties: {
      emotionIntensity: { type: 'number', description: '感情の強さ。0(平静)〜100(非常に強い)の整数。' },
      topicTags: { type: 'array', items: { type: 'string' }, description: '話題を表す短い日本語タグ（最大5件）' },
    },
    required: ['emotionIntensity', 'topicTags'],
    additionalProperties: false,
  },
  maxTokens: 512,
  validate: (parsed) => {
    const obj = assertRecord(parsed, 'root');
    return {
      emotionIntensity: assertNumberInRange(obj.emotionIntensity, 'emotionIntensity', 0, 100),
      topicTags: assertStringArray(obj.topicTags, 'topicTags', { maxItems: 5 }),
    };
  },
};

// ---------------------------------------------------------------------------
// 3. 自己分析: インサイト生成（Phase2 1.3節）
// ---------------------------------------------------------------------------

export interface InsightSynthesizeContext {
  categoryLabel: string;
  answers: { id: string; text: string }[];
}
export interface InsightSynthesizeOutput {
  insightType: InsightType;
  contentText: string;
  confidenceScore: number;
  derivedFromAnswerIds: string[];
}

const selfAnalysisInsightSynthesize: PromptTemplateDefinition<InsightSynthesizeContext, InsightSynthesizeOutput> = {
  id: 'self-analysis.insight-synthesize.v1',
  agentName: 'SelfAnalysisAgent',
  description: '複数の自己分析回答から、強み・価値観等の仮説（インサイト）を1つ要約する。',
  systemPrompt: [
    'あなたは社員の自己分析の回答群から、強み・弱み・価値観・興味・理想像・課題のいずれかの',
    'パターンを見出すアシスタントです。これはあくまで「仮説」であり、本人が確認して承認するまで',
    '確定した事実として扱われません。根拠のない決めつけをせず、必ずどの回答から読み取ったかを',
    '明示できる内容にしてください。断定的な言い切りを避け、本人が「少し違う」と感じたら',
    '修正できるよう、具体的で検証可能な文章にしてください。',
  ].join('\n'),
  buildUserMessage: (ctx) =>
    [
      `カテゴリ: ${ctx.categoryLabel}`,
      '回答一覧:',
      ...ctx.answers.map((a) => `- [${a.id}] ${a.text}`),
      '',
      'この回答群から読み取れるインサイトを1つ、種類・本文・確信度とともに生成してください。',
      '本文はどの回答(id)を根拠にしたか特定できるものだけをderivedFromAnswerIdsに含めてください。',
    ].join('\n'),
  responseSchema: {
    type: 'object',
    properties: {
      insightType: { type: 'string', enum: [...INSIGHT_TYPES], description: 'インサイトの種類' },
      contentText: { type: 'string', description: 'インサイトの本文（日本語、具体的かつ検証可能な文章）' },
      confidenceScore: { type: 'number', description: '確信度。0(弱い推測)〜100(強い根拠あり)の整数。' },
      derivedFromAnswerIds: { type: 'array', items: { type: 'string' }, description: '根拠とした回答IDの配列' },
    },
    required: ['insightType', 'contentText', 'confidenceScore', 'derivedFromAnswerIds'],
    additionalProperties: false,
  },
  maxTokens: 1024,
  validate: (parsed) => {
    const obj = assertRecord(parsed, 'root');
    return {
      insightType: assertEnum(obj.insightType, 'insightType', INSIGHT_TYPES),
      contentText: assertString(obj.contentText, 'contentText'),
      confidenceScore: assertNumberInRange(obj.confidenceScore, 'confidenceScore', 0, 100),
      derivedFromAnswerIds: assertStringArray(obj.derivedFromAnswerIds, 'derivedFromAnswerIds'),
    };
  },
};

// ---------------------------------------------------------------------------
// 4. 自己分析: 「自分では気づいていない強み」生成（Phase2 1.4節、HIDDEN_STRENGTH専用）
// ---------------------------------------------------------------------------

export interface HiddenStrengthContext {
  answers: { id: string; categoryLabel: string; text: string }[];
}
export interface HiddenStrengthOutput {
  contentText: string;
  confidenceScore: number;
  gapEvidenceAnswerIds: string[];
}

const selfAnalysisHiddenStrength: PromptTemplateDefinition<HiddenStrengthContext, HiddenStrengthOutput> = {
  id: 'self-analysis.hidden-strength.v1',
  agentName: 'SelfAnalysisAgent',
  description: '複数カテゴリの回答から、本人が自覚していない強みのギャップを検出する。',
  systemPrompt: [
    'あなたは自己分析の回答群を横断的に読み、本人が自分の言葉では強みとして語っていないが、',
    '行動描写の中に一貫して現れているパターン（＝自分では気づいていない強み）を検出する',
    'アシスタントです。本人が明示的に「自分の強みは○○だ」と述べた内容の言い換えは対象外です。',
    '本人の自己認識と、行動描写から読み取れる実際の傾向との間に「ギャップ」がある場合のみ',
    '報告してください。ギャップが見つからない場合は、その旨を正直にcontentTextに記述し、',
    'confidenceScoreを低く設定してください（無理に何かをでっち上げない）。',
  ].join('\n'),
  buildUserMessage: (ctx) =>
    [
      '回答一覧（カテゴリを横断）:',
      ...ctx.answers.map((a) => `- [${a.id}] (${a.categoryLabel}) ${a.text}`),
      '',
      '本人が自覚していない強みのギャップを検出してください。',
    ].join('\n'),
  responseSchema: {
    type: 'object',
    properties: {
      contentText: { type: 'string', description: '検出した「自分では気づいていない強み」の説明（日本語）' },
      confidenceScore: { type: 'number', description: '確信度。0〜100の整数。' },
      gapEvidenceAnswerIds: { type: 'array', items: { type: 'string' }, description: 'ギャップの根拠とした回答IDの配列' },
    },
    required: ['contentText', 'confidenceScore', 'gapEvidenceAnswerIds'],
    additionalProperties: false,
  },
  maxTokens: 1024,
  validate: (parsed) => {
    const obj = assertRecord(parsed, 'root');
    return {
      contentText: assertString(obj.contentText, 'contentText'),
      confidenceScore: assertNumberInRange(obj.confidenceScore, 'confidenceScore', 0, 100),
      gapEvidenceAnswerIds: assertStringArray(obj.gapEvidenceAnswerIds, 'gapEvidenceAnswerIds'),
    };
  },
};

// ---------------------------------------------------------------------------
// 5. 夢探索: 仮説生成（Phase2 2.1節 DreamExplorationAgent）
// ---------------------------------------------------------------------------

export interface DreamHypothesisGenerateContext {
  insightSummaries: string[];
  priorDreamTexts: string[];
}
export interface DreamHypothesisGenerateOutput {
  hypotheses: { text: string; basis: string; confidenceScore: number }[];
}

const dreamHypothesisGenerate: PromptTemplateDefinition<DreamHypothesisGenerateContext, DreamHypothesisGenerateOutput> = {
  id: 'dream.hypothesis-generate.v1',
  agentName: 'DreamExplorationAgent',
  description: '自己分析インサイトから、本人の「夢」の仮説を複数生成する（本人が選ぶための候補提示）。',
  systemPrompt: [
    'あなたは社員のキャリアの「夢」を一緒に探索するアシスタントです。あなたが夢を決めることは',
    '絶対にありません。自己分析で確認済みの強み・価値観・興味から、本人が「これかもしれない」と',
    '検討できる夢の仮説を2〜3個、並列の選択肢として提示してください。単一の正解を押し付ける',
    '書き方（「あなたの夢は○○です」等の断定）は避け、「〜という可能性があります」という',
    '仮説の形で書いてください。各仮説には、どの情報から導いたか（basis）を必ず添えてください。',
  ].join('\n'),
  buildUserMessage: (ctx) =>
    [
      '確認済みの自己分析インサイト:',
      ...ctx.insightSummaries.map((s) => `- ${s}`),
      ctx.priorDreamTexts.length > 0
        ? `\n過去に検討した夢の仮説:\n${ctx.priorDreamTexts.map((t) => `- ${t}`).join('\n')}`
        : '',
      '',
      '夢の仮説を2〜3個生成してください。',
    ]
      .filter(Boolean)
      .join('\n'),
  responseSchema: {
    type: 'object',
    properties: {
      hypotheses: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            text: { type: 'string', description: '夢の仮説の本文（日本語、「〜という可能性があります」調）' },
            basis: { type: 'string', description: 'この仮説の生成根拠の説明' },
            confidenceScore: { type: 'number', description: '確信度。0〜100の整数。' },
          },
          required: ['text', 'basis', 'confidenceScore'],
          additionalProperties: false,
        },
        description: '夢の仮説の配列（2〜3件）',
      },
    },
    required: ['hypotheses'],
    additionalProperties: false,
  },
  maxTokens: 1536,
  validate: (parsed) => {
    const obj = assertRecord(parsed, 'root');
    return {
      hypotheses: assertArray(
        obj.hypotheses,
        'hypotheses',
        (item, i) => {
          const h = assertRecord(item, `hypotheses[${i}]`);
          return {
            text: assertString(h.text, `hypotheses[${i}].text`),
            basis: assertString(h.basis, `hypotheses[${i}].basis`),
            confidenceScore: assertNumberInRange(h.confidenceScore, `hypotheses[${i}].confidenceScore`, 0, 100),
          };
        },
        { minItems: 1, maxItems: 3 },
      ),
    };
  },
};

// ---------------------------------------------------------------------------
// 6. Why深掘り（Phase2 3章想定 WhyEngine、<why>要件の中核実装）
// ---------------------------------------------------------------------------

export interface WhyDeepenContext {
  subjectContent: string;
  currentDepth: number;
  userWhyText?: string;
  relatedInsightSummaries: string[];
}
export interface WhyDeepenOutput {
  convictionScore: number;
  isWeak: boolean;
  followUpQuestion?: string;
  aiInferredReason?: string;
}

const whyDeepen: PromptTemplateDefinition<WhyDeepenContext, WhyDeepenOutput> = {
  id: 'why.deepen.v1',
  agentName: 'WhyEngine',
  description: '目標・方向性・夢に対する本人のWhyを検査し、弱ければ深掘りの質問を生成する。',
  systemPrompt: [
    'あなたは社員が掲げた目標・方向性・夢について「なぜそれを目指すのか(Why)」を一緒に',
    '掘り下げるアシスタントです。<why>要件: 目標を確定させる前に、必ずWhyの強さを検査し、',
    '弱い場合は本人が納得できるまで問いを重ねます。あなたがWhyを代わりに作り出すのではなく、',
    '本人の言葉が本当に本人の腹落ちした理由になっているかを検査してください。',
    '本人がまだ理由を述べていない場合は、それを引き出す最初の問いを生成してください。',
    '理由が述べられているが、表面的（会社の建前の反復、他者の受け売り、単なる目標の言い換え等）な',
    '場合はisWeak=trueとし、より深い動機を引き出す一段深い問いをfollowUpQuestionに設定してください。',
    '理由が本人の実体験や価値観に根ざしていて十分に強いと判断できる場合のみisWeak=falseとし、',
    'followUpQuestionは省略してください。aiInferredReasonは、本人の回答からうかがえる根底の',
    '動機についてのあなたの推測がある場合のみ、あくまで仮説として設定してください（本人はまだ',
    'これを承認していない前提で扱われます）。',
  ].join('\n'),
  buildUserMessage: (ctx) =>
    [
      `対象: ${ctx.subjectContent}`,
      `現在の深掘り段階: ${ctx.currentDepth}`,
      ctx.userWhyText ? `本人が述べた理由: ${ctx.userWhyText}` : '本人はまだ理由を述べていません。',
      ctx.relatedInsightSummaries.length > 0
        ? `関連する自己分析インサイト:\n${ctx.relatedInsightSummaries.map((s) => `- ${s}`).join('\n')}`
        : '',
      '',
      'Whyの強さを検査し、必要なら深掘りの問いを生成してください。',
    ]
      .filter(Boolean)
      .join('\n'),
  responseSchema: {
    type: 'object',
    properties: {
      convictionScore: { type: 'number', description: '納得度・確信度。0(非常に弱い)〜100(非常に強い)の整数。' },
      isWeak: { type: 'boolean', description: '現段階のWhyが弱く、深掘りが必要かどうか' },
      followUpQuestion: { type: 'string', description: '深掘りのための次の問い（isWeak=trueの場合のみ設定）' },
      aiInferredReason: { type: 'string', description: 'AIが推測した根底の動機（仮説、任意）' },
    },
    required: ['convictionScore', 'isWeak'],
    additionalProperties: false,
  },
  maxTokens: 768,
  validate: (parsed) => {
    const obj = assertRecord(parsed, 'root');
    return {
      convictionScore: assertNumberInRange(obj.convictionScore, 'convictionScore', 0, 100),
      isWeak: assertBoolean(obj.isWeak, 'isWeak'),
      followUpQuestion: assertOptionalString(obj.followUpQuestion, 'followUpQuestion'),
      aiInferredReason: assertOptionalString(obj.aiInferredReason, 'aiInferredReason'),
    };
  },
};

// ---------------------------------------------------------------------------
// 7. 目標候補生成（<implementation_scope> 14番、GoalStructuringAgent）
// ---------------------------------------------------------------------------

export interface GoalCandidateGenerateContext {
  directionOrVisionText: string;
  whyText?: string;
  relatedInsightSummaries: string[];
  institutionOptions: { id: string; label: string; kind: 'kpi' | 'ulm' }[];
  /** <continuous_ai>「次の目標」。達成済み目標のタイトルを渡すと、その延長線上の候補を優先する。 */
  achievedGoalContext?: string;
}
export interface GoalCandidateGenerateOutput {
  candidates: {
    title: string;
    description: string;
    rationale: string;
    relatedInstitutionId?: string;
  }[];
}

const goalCandidateGenerate: PromptTemplateDefinition<GoalCandidateGenerateContext, GoalCandidateGenerateOutput> = {
  id: 'goal-candidate.generate.v1',
  agentName: 'GoalStructuringAgent',
  description: '方向性・Why・会社KPI/ULMから、本人が確定するための長期目標の候補を生成する。',
  systemPrompt: [
    'あなたは社員のキャリアの方向性とWhy(なぜそれを目指すのか)から、具体的な長期目標の候補を',
    '提案するアシスタントです。<ai_principles>: あなたは目標を決定しません。候補を提示するのみで、',
    '最終的な確定は必ず本人が行います。<company_alignment>: 会社のKPIやUnit Leaders Missionと',
    '接続できそうな候補がある場合は、その候補が「本人にとってどんな成長になるか」を',
    'rationaleに含めてください（KPI/ULMをそのまま目標として提示するのではなく、必ず本人の',
    '成長・Whyとの接続を言語化する）。接続先が見当たらない候補があっても構いません。',
    '候補は1〜3個、実現可能な粒度で提示してください。',
  ].join('\n'),
  buildUserMessage: (ctx) =>
    [
      `方向性/Vision: ${ctx.directionOrVisionText}`,
      ctx.whyText ? `Why: ${ctx.whyText}` : '',
      ctx.achievedGoalContext
        ? `本人は直前に次の目標を達成しました。その延長線上にある次の目標を優先して提案してください: ${ctx.achievedGoalContext}`
        : '',
      ctx.relatedInsightSummaries.length > 0
        ? `関連インサイト:\n${ctx.relatedInsightSummaries.map((s) => `- ${s}`).join('\n')}`
        : '',
      ctx.institutionOptions.length > 0
        ? `参考: 会社のKPI/ULM一覧:\n${ctx.institutionOptions.map((o) => `- [${o.id}] (${o.kind}) ${o.label}`).join('\n')}`
        : '',
      '',
      '長期目標の候補を1〜3個生成してください。',
    ]
      .filter(Boolean)
      .join('\n'),
  responseSchema: {
    type: 'object',
    properties: {
      candidates: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string', description: '目標タイトル（日本語、簡潔に）' },
            description: { type: 'string', description: '目標の詳細説明' },
            rationale: { type: 'string', description: 'なぜこの候補を提案したか（Whyとの接続を含む）' },
            relatedInstitutionId: { type: 'string', description: '関連する会社KPI/ULMのID（該当する場合のみ）' },
          },
          required: ['title', 'description', 'rationale'],
          additionalProperties: false,
        },
        description: '目標候補の配列（1〜3件）',
      },
    },
    required: ['candidates'],
    additionalProperties: false,
  },
  maxTokens: 1536,
  validate: (parsed) => {
    const obj = assertRecord(parsed, 'root');
    return {
      candidates: assertArray(
        obj.candidates,
        'candidates',
        (item, i) => {
          const c = assertRecord(item, `candidates[${i}]`);
          return {
            title: assertString(c.title, `candidates[${i}].title`),
            description: assertString(c.description, `candidates[${i}].description`),
            rationale: assertString(c.rationale, `candidates[${i}].rationale`),
            relatedInstitutionId: assertOptionalString(c.relatedInstitutionId, `candidates[${i}].relatedInstitutionId`),
          };
        },
        { minItems: 1, maxItems: 3 },
      ),
    };
  },
};

// ---------------------------------------------------------------------------
// 8. SMART誘導質問生成（<smart_guidance>要件、SmartGuidanceAgent）
// ---------------------------------------------------------------------------

export interface SmartGuidanceContext {
  draftTitle: string;
  draftDescription?: string;
  draftTargetDate?: string;
}
export interface SmartGuidanceOutput {
  weakestCriterion: 'specific' | 'measurable' | 'achievable' | 'relevant' | 'timebound';
  question: string;
}

const smartGuidanceQuestion: PromptTemplateDefinition<SmartGuidanceContext, SmartGuidanceOutput> = {
  id: 'smart.guidance-question.v1',
  agentName: 'SmartGuidanceAgent',
  description: '目標作成中に、SMARTの観点で最も曖昧な部分を1つ選び、それを埋める質問を生成する。',
  systemPrompt: [
    'あなたは目標がSMART（Specific/Measurable/Achievable/Relevant/Time-bound）になるよう、',
    '作成中の本人に問いかけるアシスタントです。目標を代わりに書き直すことはしません。',
    '下書きを読み、5つの観点のうち最も曖昧・不足していると感じるものを1つ選び、',
    'それを本人が具体化できるような質問を1つだけ生成してください。',
  ].join('\n'),
  buildUserMessage: (ctx) =>
    [
      `目標タイトル(下書き): ${ctx.draftTitle}`,
      ctx.draftDescription ? `詳細(下書き): ${ctx.draftDescription}` : '詳細はまだ書かれていません。',
      ctx.draftTargetDate ? `期限(下書き): ${ctx.draftTargetDate}` : '期限はまだ設定されていません。',
      '',
      '最も曖昧なSMART観点を1つ選び、それを埋める質問を生成してください。',
    ].join('\n'),
  responseSchema: {
    type: 'object',
    properties: {
      weakestCriterion: {
        type: 'string',
        enum: ['specific', 'measurable', 'achievable', 'relevant', 'timebound'],
        description: '最も曖昧なSMART観点',
      },
      question: { type: 'string', description: 'その観点を具体化するための質問（日本語、1文）' },
    },
    required: ['weakestCriterion', 'question'],
    additionalProperties: false,
  },
  maxTokens: 512,
  validate: (parsed) => {
    const obj = assertRecord(parsed, 'root');
    return {
      weakestCriterion: assertEnum(obj.weakestCriterion, 'weakestCriterion', [
        'specific',
        'measurable',
        'achievable',
        'relevant',
        'timebound',
      ] as const),
      question: assertString(obj.question, 'question'),
    };
  },
};

// ---------------------------------------------------------------------------
// 9. SMART監査（<smart_gate>要件、SmartGateAgent）
// ---------------------------------------------------------------------------

export interface SmartAuditContext {
  title: string;
  description?: string;
  targetDate?: string;
  whyText?: string;
  directionText?: string;
}
export interface SmartAuditOutput {
  specific: 'ok' | 'needs_improvement' | 'insufficient';
  measurable: 'ok' | 'needs_improvement' | 'insufficient';
  achievable: 'ok' | 'needs_improvement' | 'insufficient';
  relevant: 'ok' | 'needs_improvement' | 'insufficient';
  timebound: 'ok' | 'needs_improvement' | 'insufficient';
  auditNote: string;
  followUpQuestions: string[];
}

const SMART_RESULT_VALUES = ['ok', 'needs_improvement', 'insufficient'] as const;

const smartAudit: PromptTemplateDefinition<SmartAuditContext, SmartAuditOutput> = {
  id: 'smart.audit.v1',
  agentName: 'SmartGateAgent',
  description: '目標保存直前のSMART監査。5項目をOK/要改善/不足で判定し、不足項目には追加質問を添える。',
  systemPrompt: [
    'あなたは目標がSMART（Specific/Measurable/Achievable/Relevant/Time-bound）の要件を',
    '満たしているかを監査するアシスタントです。あなたが目標を書き直すことはありません。',
    '5項目それぞれを ok（十分）/ needs_improvement（要改善）/ insufficient（不足）で判定し、',
    'okでない項目については、本人が目標を改善するための具体的な追加質問を生成してください。',
    'Specific=何をするのか, Measurable=何をもって達成とするか, Achievable=現実的に達成可能か,',
    'Relevant=夢・キャリア・Whyとつながっているか, Time-bound=期限はいつか、の5観点で判定します。',
    'Relevantの判定では、提示されたWhy/方向性と目標の内容が実際につながっているかを厳密に見てください。',
  ].join('\n'),
  buildUserMessage: (ctx) =>
    [
      `目標タイトル: ${ctx.title}`,
      ctx.description ? `詳細: ${ctx.description}` : '詳細: (未記入)',
      ctx.targetDate ? `期限: ${ctx.targetDate}` : '期限: (未設定)',
      ctx.directionText ? `関連する方向性: ${ctx.directionText}` : '',
      ctx.whyText ? `Why: ${ctx.whyText}` : 'Why: (未記入)',
      '',
      'SMART監査を実行してください。',
    ]
      .filter(Boolean)
      .join('\n'),
  responseSchema: {
    type: 'object',
    properties: {
      specific: { type: 'string', enum: [...SMART_RESULT_VALUES] },
      measurable: { type: 'string', enum: [...SMART_RESULT_VALUES] },
      achievable: { type: 'string', enum: [...SMART_RESULT_VALUES] },
      relevant: { type: 'string', enum: [...SMART_RESULT_VALUES] },
      timebound: { type: 'string', enum: [...SMART_RESULT_VALUES] },
      auditNote: { type: 'string', description: '監査結果の総評（日本語、簡潔に）' },
      followUpQuestions: {
        type: 'array',
        items: { type: 'string' },
        description: 'okでない項目を改善するための追加質問（最大5件）',
      },
    },
    required: ['specific', 'measurable', 'achievable', 'relevant', 'timebound', 'auditNote', 'followUpQuestions'],
    additionalProperties: false,
  },
  maxTokens: 1024,
  validate: (parsed) => {
    const obj = assertRecord(parsed, 'root');
    return {
      specific: assertEnum(obj.specific, 'specific', SMART_RESULT_VALUES),
      measurable: assertEnum(obj.measurable, 'measurable', SMART_RESULT_VALUES),
      achievable: assertEnum(obj.achievable, 'achievable', SMART_RESULT_VALUES),
      relevant: assertEnum(obj.relevant, 'relevant', SMART_RESULT_VALUES),
      timebound: assertEnum(obj.timebound, 'timebound', SMART_RESULT_VALUES),
      auditNote: assertString(obj.auditNote, 'auditNote'),
      followUpQuestions: assertStringArray(obj.followUpQuestions, 'followUpQuestions', { maxItems: 5 }),
    };
  },
};

// ---------------------------------------------------------------------------
// 10. 進捗確認の問いかけ生成（<continuous_ai>「進捗確認」、ProgressMonitor）
// ---------------------------------------------------------------------------

export interface ProgressCheckinContext {
  goalTitle: string;
  checkpointTitle?: string;
  recentProgressNotes: string[];
  daysUntilDue?: number;
}
export interface ProgressCheckinOutput {
  question: string;
}

const progressCheckinQuestion: PromptTemplateDefinition<ProgressCheckinContext, ProgressCheckinOutput> = {
  id: 'goal.progress-checkin-question.v1',
  agentName: 'ProgressMonitor',
  description: '目標/通過点の進捗確認のタイミングで、本人に投げかける状況確認の問いを生成する。',
  systemPrompt: [
    'あなたは社員の目標の進捗を見守るアシスタントです。進捗を代わりに記録することはありません。',
    '直近の進捗記録と期限までの残り日数を踏まえ、本人が現状を言語化しやすい、',
    '答えやすい問いを1つ生成してください。詰問調は避け、共感的な聞き方にしてください。',
  ].join('\n'),
  buildUserMessage: (ctx) =>
    [
      `目標: ${ctx.goalTitle}`,
      ctx.checkpointTitle ? `通過点: ${ctx.checkpointTitle}` : '',
      ctx.recentProgressNotes.length > 0
        ? `直近の進捗記録:\n${ctx.recentProgressNotes.map((n) => `- ${n}`).join('\n')}`
        : '進捗記録はまだありません。',
      ctx.daysUntilDue !== undefined ? `期限まで残り${ctx.daysUntilDue}日` : '',
      '',
      '進捗確認の問いを1つ生成してください。',
    ]
      .filter(Boolean)
      .join('\n'),
  responseSchema: {
    type: 'object',
    properties: { question: { type: 'string', description: '進捗確認の問い（日本語、1文）' } },
    required: ['question'],
    additionalProperties: false,
  },
  maxTokens: 512,
  validate: (parsed) => ({ question: assertString(assertRecord(parsed, 'root').question, 'question') }),
};

// ---------------------------------------------------------------------------
// 11. 振り返りの問いかけ生成（<continuous_ai>「振り返り」、ProgressMonitor）
// ---------------------------------------------------------------------------

export interface ReflectionPromptContext {
  goalTitle: string;
  checkpointTitle?: string;
  progressSummary: string;
}
export interface ReflectionPromptOutput {
  prompt: string;
}

const reflectionPromptGenerate: PromptTemplateDefinition<ReflectionPromptContext, ReflectionPromptOutput> = {
  id: 'goal.reflection-prompt.v1',
  agentName: 'ProgressMonitor',
  description: '振り返りのタイミングで、本人の学びを引き出す問いを生成する。',
  systemPrompt: [
    'あなたは社員の振り返りを支援するアシスタントです。振り返りの内容を代わりに書くことはありません。',
    'これまでの進捗を踏まえ、「何がうまくいったか」「何を学んだか」「次にどう活かすか」を',
    '本人が言語化できるような、開かれた問いを1つ生成してください。',
  ].join('\n'),
  buildUserMessage: (ctx) =>
    [
      `目標: ${ctx.goalTitle}`,
      ctx.checkpointTitle ? `通過点: ${ctx.checkpointTitle}` : '',
      `これまでの進捗の要約: ${ctx.progressSummary}`,
      '',
      '振り返りを引き出す問いを1つ生成してください。',
    ]
      .filter(Boolean)
      .join('\n'),
  responseSchema: {
    type: 'object',
    properties: { prompt: { type: 'string', description: '振り返りの問い（日本語、1文）' } },
    required: ['prompt'],
    additionalProperties: false,
  },
  maxTokens: 512,
  validate: (parsed) => ({ prompt: assertString(assertRecord(parsed, 'root').prompt, 'prompt') }),
};

// ---------------------------------------------------------------------------
// 12. 課題発見・目標修正候補・次アクション提案（<continuous_ai>、ProgressMonitor/
//     GoalRevisionAgent/NextActionAgent。まとめて1回のAI呼び出しで生成し、種類ごとに
//     GoalAiInsightとして永続化する）
// ---------------------------------------------------------------------------

export interface GoalAiAnalysisContext {
  goalTitle: string;
  goalDescription?: string;
  targetDate?: string;
  whyText?: string;
  recentProgressNotes: string[];
  recentReflections: string[];
  incompleteActionTitles: string[];
}
export interface GoalAiAnalysisOutput {
  issues: { text: string; confidenceScore: number }[];
  revisionCandidates: { text: string; proposedTitle?: string; proposedTargetDate?: string; confidenceScore: number }[];
  nextActions: { title: string; description: string; confidenceScore: number }[];
}

const goalAiAnalysis: PromptTemplateDefinition<GoalAiAnalysisContext, GoalAiAnalysisOutput> = {
  id: 'goal.ai-analysis.v1',
  agentName: 'ProgressMonitor',
  description: '目標の進捗・振り返り・未完了行動から、課題・目標修正候補・次アクションを提案する。',
  systemPrompt: [
    'あなたは社員の目標達成を支援するアシスタントです。<ai_principles>: あなたが目標や行動を',
    '決定することは絶対にありません。気づいたことを「課題」「目標修正の候補」「次にやるとよい',
    'アクション」として提示するのみで、採用するかどうかは必ず本人が判断します。',
    '根拠のない決めつけを避け、進捗記録・振り返り・未完了の行動から実際に読み取れることだけを',
    '書いてください。該当がなければ、それぞれ空配列を返して構いません（無理に何かを作らない）。',
    '目標修正候補では、期限が非現実的、内容が状況と乖離している等、具体的な兆候がある場合のみ',
    '提案してください。',
  ].join('\n'),
  buildUserMessage: (ctx) =>
    [
      `目標: ${ctx.goalTitle}`,
      ctx.goalDescription ? `詳細: ${ctx.goalDescription}` : '',
      ctx.targetDate ? `期限: ${ctx.targetDate}` : '期限: (未設定)',
      ctx.whyText ? `Why: ${ctx.whyText}` : '',
      ctx.recentProgressNotes.length > 0
        ? `直近の進捗記録:\n${ctx.recentProgressNotes.map((n) => `- ${n}`).join('\n')}`
        : '進捗記録: なし',
      ctx.recentReflections.length > 0
        ? `直近の振り返り:\n${ctx.recentReflections.map((n) => `- ${n}`).join('\n')}`
        : '振り返り: なし',
      ctx.incompleteActionTitles.length > 0
        ? `未完了の行動:\n${ctx.incompleteActionTitles.map((n) => `- ${n}`).join('\n')}`
        : '未完了の行動: なし',
      '',
      '課題・目標修正候補・次アクションを分析してください。',
    ]
      .filter(Boolean)
      .join('\n'),
  responseSchema: {
    type: 'object',
    properties: {
      issues: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            text: { type: 'string', description: '検出した課題の説明' },
            confidenceScore: { type: 'number', description: '確信度。0〜100の整数。' },
          },
          required: ['text', 'confidenceScore'],
          additionalProperties: false,
        },
        description: '検出した課題（該当なしなら空配列、最大3件）',
      },
      revisionCandidates: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            text: { type: 'string', description: '修正提案の説明（なぜ修正が必要か）' },
            proposedTitle: { type: 'string', description: '新しいタイトル案（変更する場合のみ）' },
            proposedTargetDate: { type: 'string', description: '新しい期限案 YYYY-MM-DD（変更する場合のみ）' },
            confidenceScore: { type: 'number', description: '確信度。0〜100の整数。' },
          },
          required: ['text', 'confidenceScore'],
          additionalProperties: false,
        },
        description: '目標修正候補（該当なしなら空配列、最大2件）',
      },
      nextActions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string', description: '次アクションのタイトル' },
            description: { type: 'string', description: '次アクションの詳細' },
            confidenceScore: { type: 'number', description: '確信度。0〜100の整数。' },
          },
          required: ['title', 'description', 'confidenceScore'],
          additionalProperties: false,
        },
        description: '次アクション提案（該当なしなら空配列、最大3件）',
      },
    },
    required: ['issues', 'revisionCandidates', 'nextActions'],
    additionalProperties: false,
  },
  maxTokens: 2048,
  validate: (parsed) => {
    const obj = assertRecord(parsed, 'root');
    return {
      issues: assertArray(
        obj.issues,
        'issues',
        (item, i) => {
          const it = assertRecord(item, `issues[${i}]`);
          return {
            text: assertString(it.text, `issues[${i}].text`),
            confidenceScore: assertNumberInRange(it.confidenceScore, `issues[${i}].confidenceScore`, 0, 100),
          };
        },
        { maxItems: 3 },
      ),
      revisionCandidates: assertArray(
        obj.revisionCandidates,
        'revisionCandidates',
        (item, i) => {
          const it = assertRecord(item, `revisionCandidates[${i}]`);
          return {
            text: assertString(it.text, `revisionCandidates[${i}].text`),
            proposedTitle: assertOptionalString(it.proposedTitle, `revisionCandidates[${i}].proposedTitle`),
            proposedTargetDate: assertOptionalString(
              it.proposedTargetDate,
              `revisionCandidates[${i}].proposedTargetDate`,
            ),
            confidenceScore: assertNumberInRange(
              it.confidenceScore,
              `revisionCandidates[${i}].confidenceScore`,
              0,
              100,
            ),
          };
        },
        { maxItems: 2 },
      ),
      nextActions: assertArray(
        obj.nextActions,
        'nextActions',
        (item, i) => {
          const it = assertRecord(item, `nextActions[${i}]`);
          return {
            title: assertString(it.title, `nextActions[${i}].title`),
            description: assertString(it.description, `nextActions[${i}].description`),
            confidenceScore: assertNumberInRange(it.confidenceScore, `nextActions[${i}].confidenceScore`, 0, 100),
          };
        },
        { maxItems: 3 },
      ),
    };
  },
};

// ---------------------------------------------------------------------------
// 13. 1on1事前サマリ生成（<one_on_one>要件、OneOnOneBriefAgent）
// ---------------------------------------------------------------------------

export interface OneOnOnePrepContext {
  memberName: string;
  previousSessionNotes?: string;
  goalProgressFacts: string[];
  changesSinceLastSession: string[];
  recentIssues: string[];
  incompleteActionTitles: string[];
  recentAchievements: string[];
  fieldContextNotes: string[];
}
export interface OneOnOnePrepOutput {
  goalProgressSummary: string;
  changesSummary?: string;
  issuesSummary?: string;
  incompleteActionsSummary?: string;
  achievementsSummary?: string;
  fieldContextSummary?: string;
  recommendedQuestions: string[];
  goalRevisionCandidates: string[];
  nextActionCandidates: string[];
}

const oneOnOnePrepSummary: PromptTemplateDefinition<OneOnOnePrepContext, OneOnOnePrepOutput> = {
  id: 'one-on-one.prep-summary.v1',
  agentName: 'OneOnOneBriefAgent',
  description: '1on1前に、前回内容・目標進捗・変化・課題・未完了行動・成果・現場状況をUL向けに要約する。',
  systemPrompt: [
    'あなたはUnit Leaderの1on1準備を支援するアシスタントです。<one_on_one>要件: あなたは1on1の',
    '最終判断を一切行いません。事実の要約と、ULが会話を進めやすくするための材料（推奨質問・',
    '目標修正候補・次アクション候補）を提示するのみです。実際にどう話すか、何を決めるかは',
    'ULが判断します。要約は憶測を避け、与えられた事実に基づいてください。データがない項目は',
    '省略して構いません（無理に埋めない）。',
  ].join('\n'),
  buildUserMessage: (ctx) =>
    [
      `対象メンバー: ${ctx.memberName}`,
      ctx.previousSessionNotes ? `前回の1on1メモ: ${ctx.previousSessionNotes}` : '前回の1on1メモ: なし',
      ctx.goalProgressFacts.length > 0
        ? `目標進捗の事実:\n${ctx.goalProgressFacts.map((f) => `- ${f}`).join('\n')}`
        : '目標進捗の事実: なし',
      ctx.changesSinceLastSession.length > 0
        ? `前回からの変化:\n${ctx.changesSinceLastSession.map((f) => `- ${f}`).join('\n')}`
        : '',
      ctx.recentIssues.length > 0 ? `直近の課題:\n${ctx.recentIssues.map((f) => `- ${f}`).join('\n')}` : '',
      ctx.incompleteActionTitles.length > 0
        ? `未完了の行動:\n${ctx.incompleteActionTitles.map((f) => `- ${f}`).join('\n')}`
        : '',
      ctx.recentAchievements.length > 0 ? `直近の成果:\n${ctx.recentAchievements.map((f) => `- ${f}`).join('\n')}` : '',
      ctx.fieldContextNotes.length > 0
        ? `現場状況:\n${ctx.fieldContextNotes.map((f) => `- ${f}`).join('\n')}`
        : '',
      '',
      '1on1の事前サマリを生成してください。',
    ]
      .filter(Boolean)
      .join('\n'),
  responseSchema: {
    type: 'object',
    properties: {
      goalProgressSummary: { type: 'string', description: '目標進捗の要約' },
      changesSummary: { type: 'string', description: '前回からの変化の要約' },
      issuesSummary: { type: 'string', description: '課題の要約' },
      incompleteActionsSummary: { type: 'string', description: '未完了行動の要約' },
      achievementsSummary: { type: 'string', description: '成果の要約' },
      fieldContextSummary: { type: 'string', description: '現場状況の要約' },
      recommendedQuestions: {
        type: 'array',
        items: { type: 'string' },
        description: 'ULが1on1で使える推奨質問（最大5件）',
      },
      goalRevisionCandidates: {
        type: 'array',
        items: { type: 'string' },
        description: '目標修正候補（該当なしなら空配列、最大3件）',
      },
      nextActionCandidates: {
        type: 'array',
        items: { type: 'string' },
        description: '次アクション候補（該当なしなら空配列、最大3件）',
      },
    },
    required: ['goalProgressSummary', 'recommendedQuestions', 'goalRevisionCandidates', 'nextActionCandidates'],
    additionalProperties: false,
  },
  maxTokens: 2048,
  validate: (parsed) => {
    const obj = assertRecord(parsed, 'root');
    return {
      goalProgressSummary: assertString(obj.goalProgressSummary, 'goalProgressSummary'),
      changesSummary: assertOptionalString(obj.changesSummary, 'changesSummary'),
      issuesSummary: assertOptionalString(obj.issuesSummary, 'issuesSummary'),
      incompleteActionsSummary: assertOptionalString(obj.incompleteActionsSummary, 'incompleteActionsSummary'),
      achievementsSummary: assertOptionalString(obj.achievementsSummary, 'achievementsSummary'),
      fieldContextSummary: assertOptionalString(obj.fieldContextSummary, 'fieldContextSummary'),
      recommendedQuestions: assertStringArray(obj.recommendedQuestions, 'recommendedQuestions', { maxItems: 5 }),
      goalRevisionCandidates: assertStringArray(obj.goalRevisionCandidates, 'goalRevisionCandidates', { maxItems: 3 }),
      nextActionCandidates: assertStringArray(obj.nextActionCandidates, 'nextActionCandidates', { maxItems: 3 }),
    };
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const PROMPT_TEMPLATES: Record<string, PromptTemplateDefinition<any, any>> = {
  [selfAnalysisFollowupQuestion.id]: selfAnalysisFollowupQuestion,
  [selfAnalysisAnswerClassify.id]: selfAnalysisAnswerClassify,
  [selfAnalysisInsightSynthesize.id]: selfAnalysisInsightSynthesize,
  [selfAnalysisHiddenStrength.id]: selfAnalysisHiddenStrength,
  [dreamHypothesisGenerate.id]: dreamHypothesisGenerate,
  [whyDeepen.id]: whyDeepen,
  [smartGuidanceQuestion.id]: smartGuidanceQuestion,
  [smartAudit.id]: smartAudit,
  [progressCheckinQuestion.id]: progressCheckinQuestion,
  [reflectionPromptGenerate.id]: reflectionPromptGenerate,
  [goalAiAnalysis.id]: goalAiAnalysis,
  [oneOnOnePrepSummary.id]: oneOnOnePrepSummary,
  [goalCandidateGenerate.id]: goalCandidateGenerate,
};
