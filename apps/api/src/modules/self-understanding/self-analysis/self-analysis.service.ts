import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { SelfAnalysisAnswer, SelfAnalysisInsight, SelfAnalysisSession } from '@prisma/client';
import type { SelfAnalysisCategory } from '@career-compass/shared';
import { PrismaService } from '../../../prisma/prisma.service';
import type { RequestContext } from '../../../common/context/request-context';
import { AiOrchestrationService } from '../../ai-orchestration/ai-orchestration.service';
import type {
  AnswerClassifyOutput,
  FollowupQuestionOutput,
  HiddenStrengthOutput,
  InsightSynthesizeOutput,
} from '../../ai-orchestration/prompt-templates';
import { toQualitativeIndicator, type QualitativeIndicator } from '../../../common/utils/score-label';
import { BASE_QUESTIONS, CATEGORY_LABELS } from './question-bank';
import { CATEGORY_ORDER, decideBranch } from './branch-rules';
import { dictionaryMatchEmotionIntensity } from './emotion-keyword-dictionary';
import type { SubmitAnswerDto } from './dto/submit-answer.dto';
import type { InsightReaction, ReactToInsightDto } from './dto/react-to-insight.dto';

export type PublicAnswer = Omit<SelfAnalysisAnswer, 'emotionIntensityInternal'>;
export type PublicInsight = Omit<SelfAnalysisInsight, 'confidenceScoreInternal'> & {
  confidenceIndicator: QualitativeIndicator | null;
};

export interface NextQuestion {
  categoryCode: SelfAnalysisCategory;
  questionText: string;
  depthLevel: number;
}

function toPublicAnswer(answer: SelfAnalysisAnswer): PublicAnswer {
  const { emotionIntensityInternal: _omit, ...rest } = answer;
  return rest;
}

function toPublicInsight(insight: SelfAnalysisInsight): PublicInsight {
  const { confidenceScoreInternal, ...rest } = insight;
  return { ...rest, confidenceIndicator: toQualitativeIndicator(confidenceScoreInternal) };
}

/**
 * Phase2 1章「自己分析エンジン」。<implementation_scope> 1〜5番の実装本体。
 * 質問エンジン（カテゴリ選出・分岐判定）はコードロジック（branch-rules.ts）で行い、
 * AIは「深掘り質問の文面生成」「インサイトの要約」等の生成タスクにのみ関与する
 * （<ai_principles>「AIは問いかけ・整理・仮説提示にとどまる」の実装）。
 */
@Injectable()
export class SelfAnalysisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiOrchestrationService,
  ) {}

  async startSession(ctx: RequestContext): Promise<{ session: SelfAnalysisSession; nextQuestion: NextQuestion }> {
    const session = await this.prisma.withRlsContext(ctx, (tx) =>
      tx.selfAnalysisSession.create({
        data: { employeeId: ctx.employeeId, status: 'exploring', coveredCategories: [], skippedCategories: [] },
      }),
    );
    const firstCategory = CATEGORY_ORDER[0];
    return {
      session,
      nextQuestion: { categoryCode: firstCategory, questionText: BASE_QUESTIONS[firstCategory], depthLevel: 0 },
    };
  }

  async listSessions(ctx: RequestContext): Promise<SelfAnalysisSession[]> {
    return this.prisma.withRlsContext(ctx, (tx) =>
      tx.selfAnalysisSession.findMany({ where: { employeeId: ctx.employeeId }, orderBy: { startedAt: 'desc' } }),
    );
  }

  async getSession(id: string, ctx: RequestContext): Promise<SelfAnalysisSession> {
    const session = await this.prisma.withRlsContext(ctx, (tx) => tx.selfAnalysisSession.findUnique({ where: { id } }));
    if (!session) {
      throw new NotFoundException({ error: { code: 'NOT_FOUND', message: 'セッションが見つかりません' } });
    }
    if (session.employeeId !== ctx.employeeId) {
      // RLSにより本人以外の行は既にnullで返るはずだが、二重防御として明示チェックする。
      throw new ForbiddenException({ error: { code: 'FORBIDDEN', message: 'このセッションにはアクセスできません' } });
    }
    return session;
  }

  async listAnswers(sessionId: string, ctx: RequestContext): Promise<PublicAnswer[]> {
    await this.getSession(sessionId, ctx);
    const answers = await this.prisma.withRlsContext(ctx, (tx) =>
      tx.selfAnalysisAnswer.findMany({ where: { sessionId }, orderBy: { createdAt: 'asc' } }),
    );
    return answers.map(toPublicAnswer);
  }

  async listInsights(ctx: RequestContext): Promise<PublicInsight[]> {
    const insights = await this.prisma.withRlsContext(ctx, (tx) =>
      tx.selfAnalysisInsight.findMany({ where: { employeeId: ctx.employeeId }, orderBy: { createdAt: 'desc' } }),
    );
    return insights.map(toPublicInsight);
  }

  async confirmSession(sessionId: string, ctx: RequestContext): Promise<SelfAnalysisSession> {
    const session = await this.getSession(sessionId, ctx);
    if (session.status !== 'under_review') {
      throw new BadRequestException({
        error: { code: 'VALIDATION_ERROR', message: '全カテゴリを一巡してからでないと確認できません' },
      });
    }
    return this.prisma.withRlsContext(ctx, (tx) =>
      tx.selfAnalysisSession.update({ where: { id: sessionId }, data: { status: 'confirmed' } }),
    );
  }

  async submitAnswer(
    sessionId: string,
    dto: SubmitAnswerDto,
    ctx: RequestContext,
  ): Promise<{
    answer: PublicAnswer;
    nextQuestion: NextQuestion | null;
    insightGenerated: PublicInsight | null;
    sessionStatus: SelfAnalysisSession['status'];
  }> {
    const session = await this.getSession(sessionId, ctx);
    if (session.status !== 'exploring' && session.status !== 'stalled') {
      throw new BadRequestException({
        error: { code: 'VALIDATION_ERROR', message: 'このセッションは既に完了しています' },
      });
    }

    const isSkip = dto.isSkip ?? false;
    const rawText = isSkip ? null : (dto.rawText ?? null);
    if (!isSkip && (!rawText || rawText.trim().length === 0)) {
      throw new BadRequestException({ error: { code: 'VALIDATION_ERROR', message: '回答内容が空です' } });
    }

    const dictionaryScore = rawText ? dictionaryMatchEmotionIntensity(rawText) : 0;

    let answer = await this.prisma.withRlsContext(ctx, (tx) =>
      tx.selfAnalysisAnswer.create({
        data: {
          sessionId,
          employeeId: ctx.employeeId,
          categoryCode: dto.categoryCode,
          questionText: dto.questionText,
          depthLevel: dto.depthLevel,
          rawText,
          isSkip,
          emotionIntensityInternal: dictionaryScore,
          topicTags: [],
        },
      }),
    );

    // AI分類（非同期の代わりに、キュー基盤未整備の本Stepではリクエスト内で同期実行する。
    // 1〜10人規模のMVPでは許容範囲と判断した設計判断、完了報告に明記）。
    if (!isSkip && rawText) {
      try {
        const { data } = await this.ai.callAgent<AnswerClassifyOutput>({
          templateId: 'self-analysis.answer-classify.v1',
          employeeId: ctx.employeeId,
          context: { categoryLabel: CATEGORY_LABELS[dto.categoryCode], answerText: rawText },
        });
        answer = await this.prisma.withRlsContext(ctx, (tx) =>
          tx.selfAnalysisAnswer.update({
            where: { id: answer.id },
            data: { emotionIntensityInternal: data.emotionIntensity, topicTags: data.topicTags },
          }),
        );
      } catch {
        // AI分類の失敗は回答保存自体を止めない（辞書マッチの値のまま進める）。
      }
    }

    const answersInCategoryCount = await this.prisma.withRlsContext(ctx, (tx) =>
      tx.selfAnalysisAnswer.count({ where: { sessionId, categoryCode: dto.categoryCode, isSkip: false } }),
    );

    const decision = decideBranch({
      isSkip,
      rawText,
      dictionaryEmotionIntensity: dictionaryScore,
      depthLevel: dto.depthLevel,
      answersInCategoryCount,
    });

    const covered = new Set(session.coveredCategories);
    const skipped = new Set(session.skippedCategories);
    // このカテゴリが「後回し保留中」の状態で今回の回答（＝再訪の結果）を迎えたかどうか。
    // ミューテーション前に判定しておく（無限ループ防止の鍵: 再訪の結果は必ずpending状態を解消する）。
    const isRevisitAttempt = skipped.has(dto.categoryCode);

    let insightGenerated: PublicInsight | null = null;
    let nextQuestion: NextQuestion | null = null;
    let newStatus: SelfAnalysisSession['status'] = session.status;

    if (decision.type === 'defer_category' && !isRevisitAttempt) {
      // 初回のスキップ: 「後回し保留中」として記録する（coveredにはまだ入れない＝再訪の対象）。
      skipped.add(dto.categoryCode);
      nextQuestion = this.pickNextCategoryQuestion(covered, skipped);
    } else if (decision.type === 'defer_category' && isRevisitAttempt) {
      // 再訪してもなお回答したくない: これ以上は尋ねず、保留状態を解消してcoveredへ確定する。
      skipped.delete(dto.categoryCode);
      covered.add(dto.categoryCode);
      nextQuestion = this.pickNextCategoryQuestion(covered, skipped);
    } else if (decision.type === 'deep_dive' && rawText) {
      const { data } = await this.ai.callAgent<FollowupQuestionOutput>({
        templateId: 'self-analysis.followup-question.v1',
        employeeId: ctx.employeeId,
        context: {
          categoryLabel: CATEGORY_LABELS[dto.categoryCode],
          previousQuestion: dto.questionText,
          previousAnswer: rawText,
          depthLevel: dto.depthLevel,
        },
      });
      nextQuestion = { categoryCode: dto.categoryCode, questionText: data.question, depthLevel: dto.depthLevel + 1 };
    } else if (decision.type === 'reframe' && rawText) {
      const { data } = await this.ai.callAgent<FollowupQuestionOutput>({
        templateId: 'self-analysis.followup-question.v1',
        employeeId: ctx.employeeId,
        context: {
          categoryLabel: CATEGORY_LABELS[dto.categoryCode],
          previousQuestion: dto.questionText,
          previousAnswer: rawText,
          depthLevel: dto.depthLevel,
        },
      });
      nextQuestion = { categoryCode: dto.categoryCode, questionText: data.question, depthLevel: dto.depthLevel };
    } else {
      // advance または synthesize_insight_early: このカテゴリは完了とみなし、保留中であれば解消する。
      if (isRevisitAttempt) skipped.delete(dto.categoryCode);
      covered.add(dto.categoryCode);
      if (decision.type === 'synthesize_insight_early') {
        insightGenerated = await this.synthesizeInsightForCategory(dto.categoryCode, ctx);
      }
      nextQuestion = this.pickNextCategoryQuestion(covered, skipped);
    }

    if (!nextQuestion) {
      newStatus = 'under_review';
    }

    const updatedSession = await this.prisma.withRlsContext(ctx, (tx) =>
      tx.selfAnalysisSession.update({
        where: { id: sessionId },
        data: {
          coveredCategories: Array.from(covered),
          skippedCategories: Array.from(skipped),
          status: newStatus,
          lastActivityAt: new Date(),
        },
      }),
    );

    return {
      answer: toPublicAnswer(answer),
      nextQuestion,
      insightGenerated,
      sessionStatus: updatedSession.status,
    };
  }

  /**
   * 未探索カテゴリ→後回し保留中カテゴリの再訪、の順で次の基本問を選ぶ。両方尽きたらnull（一巡完了）。
   * 呼び出し側が「後回し保留中(skipped)」カテゴリの状態遷移（pending解消）を必ず正しく管理する
   * ことを前提とする（submitAnswer参照）。skippedは一時的な保留状態としてのみ使い、
   * 解消済みのカテゴリを残し続けない設計により、同じカテゴリを繰り返し再訪する無限ループを防ぐ。
   */
  private pickNextCategoryQuestion(
    covered: Set<SelfAnalysisCategory>,
    skipped: Set<SelfAnalysisCategory>,
  ): NextQuestion | null {
    for (const category of CATEGORY_ORDER) {
      if (!covered.has(category) && !skipped.has(category)) {
        return { categoryCode: category, questionText: BASE_QUESTIONS[category], depthLevel: 0 };
      }
    }
    // 未探索カテゴリが尽きたら、後回し保留中のカテゴリを再訪する（CATEGORY_ORDER順で先頭の1件）。
    for (const category of CATEGORY_ORDER) {
      if (skipped.has(category)) {
        return { categoryCode: category, questionText: BASE_QUESTIONS[category], depthLevel: 0 };
      }
    }
    return null;
  }

  private async synthesizeInsightForCategory(
    categoryCode: SelfAnalysisCategory,
    ctx: RequestContext,
  ): Promise<PublicInsight | null> {
    const answers = await this.prisma.withRlsContext(ctx, (tx) =>
      tx.selfAnalysisAnswer.findMany({
        where: { employeeId: ctx.employeeId, categoryCode, isSkip: false, rawText: { not: null } },
        orderBy: { createdAt: 'asc' },
      }),
    );
    if (answers.length === 0) return null;

    const { data } = await this.ai.callAgent<InsightSynthesizeOutput>({
      templateId: 'self-analysis.insight-synthesize.v1',
      employeeId: ctx.employeeId,
      context: {
        categoryLabel: CATEGORY_LABELS[categoryCode],
        answers: answers.map((a) => ({ id: a.id, text: a.rawText ?? '' })),
      },
    });

    const insight = await this.prisma.withRlsContext(ctx, (tx) =>
      tx.selfAnalysisInsight.create({
        data: {
          employeeId: ctx.employeeId,
          insightType: data.insightType,
          contentText: data.contentText,
          derivedFromAnswerIds: data.derivedFromAnswerIds,
          confidenceScoreInternal: data.confidenceScore,
          status: 'exploring',
          userApproved: false,
        },
      }),
    );
    return toPublicInsight(insight);
  }

  /** Phase2 1.4節。カテゴリを横断した回答からHIDDEN_STRENGTHを検出する。明示的に呼び出す操作。 */
  async generateHiddenStrength(ctx: RequestContext): Promise<PublicInsight | null> {
    const answers = await this.prisma.withRlsContext(ctx, (tx) =>
      tx.selfAnalysisAnswer.findMany({
        where: { employeeId: ctx.employeeId, isSkip: false, rawText: { not: null } },
        orderBy: { createdAt: 'asc' },
      }),
    );
    if (answers.length < 3) {
      throw new BadRequestException({
        error: { code: 'VALIDATION_ERROR', message: '検出には最低3件以上の回答が必要です' },
      });
    }

    const { data } = await this.ai.callAgent<HiddenStrengthOutput>({
      templateId: 'self-analysis.hidden-strength.v1',
      employeeId: ctx.employeeId,
      context: {
        answers: answers.map((a) => ({ id: a.id, categoryLabel: CATEGORY_LABELS[a.categoryCode], text: a.rawText ?? '' })),
      },
    });

    const insight = await this.prisma.withRlsContext(ctx, (tx) =>
      tx.selfAnalysisInsight.create({
        data: {
          employeeId: ctx.employeeId,
          insightType: 'strength',
          contentText: data.contentText,
          derivedFromAnswerIds: [],
          confidenceScoreInternal: data.confidenceScore,
          hiddenStrengthFlag: true,
          gapEvidenceAnswerIds: data.gapEvidenceAnswerIds,
          status: 'exploring',
          userApproved: false,
        },
      }),
    );
    return toPublicInsight(insight);
  }

  async reactToInsight(insightId: string, dto: ReactToInsightDto, ctx: RequestContext): Promise<PublicInsight> {
    const insight = await this.getOwnInsight(insightId, ctx);

    const reaction: InsightReaction = dto.reaction;
    if (reaction === 'adjust' && (!dto.editText || dto.editText.trim().length === 0)) {
      throw new BadRequestException({
        error: { code: 'VALIDATION_ERROR', message: 'adjustの場合はeditTextが必須です' },
      });
    }

    const updated = await this.prisma.withRlsContext(ctx, (tx) =>
      tx.selfAnalysisInsight.update({
        where: { id: insightId },
        data: {
          userApproved: reaction === 'agree' || reaction === 'adjust',
          userEditText: reaction === 'adjust' ? dto.editText : insight.userEditText,
          status: reaction === 'reject' ? 'discontinued' : 'confirmed',
          version: reaction === 'adjust' ? insight.version + 1 : insight.version,
          reviewedAt: new Date(),
        },
      }),
    );
    return toPublicInsight(updated);
  }

  private async getOwnInsight(id: string, ctx: RequestContext): Promise<SelfAnalysisInsight> {
    const insight = await this.prisma.withRlsContext(ctx, (tx) => tx.selfAnalysisInsight.findUnique({ where: { id } }));
    if (!insight || insight.employeeId !== ctx.employeeId) {
      throw new NotFoundException({ error: { code: 'NOT_FOUND', message: 'インサイトが見つかりません' } });
    }
    return insight;
  }
}
