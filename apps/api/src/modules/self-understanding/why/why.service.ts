import { Injectable, NotFoundException } from '@nestjs/common';
import type { WhyRecord } from '@prisma/client';
import type { WhySubjectType } from '@career-compass/shared';
import { PrismaService } from '../../../prisma/prisma.service';
import type { RequestContext } from '../../../common/context/request-context';
import { AiOrchestrationService } from '../../ai-orchestration/ai-orchestration.service';
import type { WhyDeepenOutput } from '../../ai-orchestration/prompt-templates';
import { toQualitativeIndicator, type QualitativeIndicator } from '../../../common/utils/score-label';

export type PublicWhyRecord = Omit<WhyRecord, 'convictionScoreInternal'> & {
  convictionIndicator: QualitativeIndicator | null;
};

function toPublicWhyRecord(w: WhyRecord): PublicWhyRecord {
  const { convictionScoreInternal, ...rest } = w;
  return { ...rest, convictionIndicator: toQualitativeIndicator(convictionScoreInternal) };
}

/** WhyRecordの確信度が「十分強い」とみなす閾値。目標階層モジュールの確定ゲートで参照する。 */
export const WHY_CONVICTION_STRONG_THRESHOLD = 60;

/**
 * Why探索エンジン（Phase2 3章想定、原文の逐語確認は未完了）。<why>要件の中核実装。
 * Vision/Direction/LongTermGoal/Checkpointのいずれにも多形態で接着する（FOUNDATION §0.1）。
 * 目標を確定する前に必ずWhyの強さを検査し、弱ければ深掘りを繰り返す、という要件は
 * このモジュール単体では完結せず、目標階層モジュール側のLongTermGoal確定処理が
 * isConvincing()を呼び出して構造的に強制する（<why>要件の「確定前ゲート」としての実装）。
 */
@Injectable()
export class WhyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiOrchestrationService,
  ) {}

  private async resolveSubjectContent(subjectType: WhySubjectType, subjectId: string, ctx: RequestContext): Promise<string> {
    const notFound = () =>
      new NotFoundException({ error: { code: 'NOT_FOUND', message: '対象のオブジェクトが見つかりません' } });

    return this.prisma.withRlsContext(ctx, async (tx) => {
      switch (subjectType) {
        case 'vision': {
          const v = await tx.vision.findUnique({ where: { id: subjectId } });
          if (!v || v.employeeId !== ctx.employeeId) throw notFound();
          return v.content;
        }
        case 'direction': {
          const d = await tx.direction.findUnique({ where: { id: subjectId } });
          if (!d || d.employeeId !== ctx.employeeId) throw notFound();
          return d.content;
        }
        case 'long_term_goal': {
          const g = await tx.longTermGoal.findUnique({ where: { id: subjectId } });
          if (!g || g.employeeId !== ctx.employeeId) throw notFound();
          return g.title;
        }
        case 'checkpoint': {
          const c = await tx.checkpoint.findUnique({ where: { id: subjectId } });
          if (!c || c.employeeId !== ctx.employeeId) throw notFound();
          return c.title;
        }
      }
    });
  }

  async listForSubject(subjectType: WhySubjectType, subjectId: string, ctx: RequestContext): Promise<PublicWhyRecord[]> {
    await this.resolveSubjectContent(subjectType, subjectId, ctx);
    const records = await this.prisma.withRlsContext(ctx, (tx) =>
      tx.whyRecord.findMany({
        where: { employeeId: ctx.employeeId, subjectType, subjectId },
        orderBy: { depthLevel: 'asc' },
      }),
    );
    return records.map(toPublicWhyRecord);
  }

  /** まだ何も答えていない段階で「最初の問い」を得るための呼び出し。DBへの書き込みは行わない。 */
  async probe(subjectType: WhySubjectType, subjectId: string, ctx: RequestContext): Promise<{ question: string }> {
    const subjectContent = await this.resolveSubjectContent(subjectType, subjectId, ctx);
    const { data } = await this.ai.callAgent<WhyDeepenOutput>({
      templateId: 'why.deepen.v1',
      employeeId: ctx.employeeId,
      context: {
        subjectContent,
        currentDepth: 0,
        relatedInsightSummaries: await this.relatedInsightSummaries(ctx),
      },
    });
    return { question: data.followUpQuestion ?? `なぜ「${subjectContent}」を目指すのですか？` };
  }

  async submitAnswer(
    subjectType: WhySubjectType,
    subjectId: string,
    userText: string,
    ctx: RequestContext,
  ): Promise<{ whyRecord: PublicWhyRecord; isWeak: boolean; followUpQuestion?: string }> {
    const subjectContent = await this.resolveSubjectContent(subjectType, subjectId, ctx);
    const existingCount = await this.prisma.withRlsContext(ctx, (tx) =>
      tx.whyRecord.count({ where: { employeeId: ctx.employeeId, subjectType, subjectId } }),
    );

    const { data } = await this.ai.callAgent<WhyDeepenOutput>({
      templateId: 'why.deepen.v1',
      employeeId: ctx.employeeId,
      context: {
        subjectContent,
        currentDepth: existingCount,
        userWhyText: userText,
        relatedInsightSummaries: await this.relatedInsightSummaries(ctx),
      },
    });

    const record = await this.prisma.withRlsContext(ctx, (tx) =>
      tx.whyRecord.create({
        data: {
          employeeId: ctx.employeeId,
          subjectType,
          subjectId,
          depthLevel: existingCount + 1,
          userText,
          source: 'user_stated',
          userApproved: true,
          convictionScoreInternal: data.convictionScore,
          status: data.isWeak ? 'exploring' : 'confirmed',
          version: 1,
        },
      }),
    );

    return { whyRecord: toPublicWhyRecord(record), isWeak: data.isWeak, followUpQuestion: data.followUpQuestion };
  }

  /** 目標階層モジュール（LongTermGoal確定ゲート）から呼び出される。十分強いWhyが存在するか。 */
  async isConvincing(subjectType: WhySubjectType, subjectId: string, ctx: RequestContext): Promise<boolean> {
    const latest = await this.prisma.withRlsContext(ctx, (tx) =>
      tx.whyRecord.findFirst({
        where: { employeeId: ctx.employeeId, subjectType, subjectId },
        orderBy: { depthLevel: 'desc' },
      }),
    );
    if (!latest) return false;
    return (latest.convictionScoreInternal ?? 0) >= WHY_CONVICTION_STRONG_THRESHOLD && latest.status === 'confirmed';
  }

  private async relatedInsightSummaries(ctx: RequestContext): Promise<string[]> {
    const insights = await this.prisma.withRlsContext(ctx, (tx) =>
      tx.selfAnalysisInsight.findMany({
        where: { employeeId: ctx.employeeId, userApproved: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    );
    return insights.map((i) => i.userEditText ?? i.contentText);
  }
}
