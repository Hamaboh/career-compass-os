import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { DreamHypothesis, Vision } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { RequestContext } from '../../../common/context/request-context';
import { AiOrchestrationService } from '../../ai-orchestration/ai-orchestration.service';
import type { DreamHypothesisGenerateOutput } from '../../ai-orchestration/prompt-templates';
import { toQualitativeIndicator, type QualitativeIndicator } from '../../../common/utils/score-label';
import type { PromoteToVisionDto } from './dto/promote-to-vision.dto';
import type { ReactToHypothesisDto } from './dto/react-to-hypothesis.dto';
import type { CreateVisionDto } from './dto/create-vision.dto';

export type PublicDreamHypothesis = Omit<DreamHypothesis, 'confidenceScoreInternal'> & {
  confidenceIndicator: QualitativeIndicator | null;
};

function toPublicHypothesis(h: DreamHypothesis): PublicDreamHypothesis {
  const { confidenceScoreInternal, ...rest } = h;
  return { ...rest, confidenceIndicator: toQualitativeIndicator(confidenceScoreInternal) };
}

/**
 * Phase2 2章「夢探索エンジン」。<implementation_scope> 6〜7番の実装本体。
 * <ai_principles>: 夢を決めるのは本人。AIは並列の仮説を複数提示するのみで、単一の正解を
 * 押し付けない（generateHypothesesが常に複数件のDreamHypothesisをclusterId単位で生成する）。
 */
@Injectable()
export class DreamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiOrchestrationService,
  ) {}

  async generateHypotheses(ctx: RequestContext): Promise<PublicDreamHypothesis[]> {
    const insights = await this.prisma.withRlsContext(ctx, (tx) =>
      tx.selfAnalysisInsight.findMany({
        where: { employeeId: ctx.employeeId, userApproved: true },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    );
    if (insights.length === 0) {
      throw new BadRequestException({
        error: { code: 'VALIDATION_ERROR', message: '本人が承認した自己分析インサイトがまだありません' },
      });
    }

    const priorHypotheses = await this.listActiveHypothesesRaw(ctx);

    const { data } = await this.ai.callAgent<DreamHypothesisGenerateOutput>({
      templateId: 'dream.hypothesis-generate.v1',
      employeeId: ctx.employeeId,
      context: {
        insightSummaries: insights.map((i) => i.userEditText ?? i.contentText),
        priorDreamTexts: priorHypotheses.map((h) => h.hypothesisText),
      },
    });

    const clusterId = randomUUID();
    const created = await this.prisma.withRlsContext(ctx, (tx) =>
      Promise.all(
        data.hypotheses.map((h) =>
          tx.dreamHypothesis.create({
            data: {
              employeeId: ctx.employeeId,
              clusterId,
              version: 1,
              hypothesisText: h.text,
              source: 'ai_inferred',
              generationBasis: { basis: h.basis, insightIds: insights.map((i) => i.id) },
              confidenceScoreInternal: h.confidenceScore,
              status: 'exploring',
            },
          }),
        ),
      ),
    );
    return created.map(toPublicHypothesis);
  }

  async listHypotheses(ctx: RequestContext): Promise<PublicDreamHypothesis[]> {
    const hypotheses = await this.listActiveHypothesesRaw(ctx);
    return hypotheses.map(toPublicHypothesis);
  }

  /** supersededAt=nullかつ、他のどの行からもpreviousVersionIdとして参照されていない=最新版のみ。 */
  private async listActiveHypothesesRaw(ctx: RequestContext): Promise<DreamHypothesis[]> {
    return this.prisma.withRlsContext(ctx, (tx) =>
      tx.dreamHypothesis.findMany({
        where: { employeeId: ctx.employeeId, supersededAt: null },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  private async getOwnHypothesis(id: string, ctx: RequestContext): Promise<DreamHypothesis> {
    const h = await this.prisma.withRlsContext(ctx, (tx) => tx.dreamHypothesis.findUnique({ where: { id } }));
    if (!h || h.employeeId !== ctx.employeeId) {
      throw new NotFoundException({ error: { code: 'NOT_FOUND', message: '夢仮説が見つかりません' } });
    }
    return h;
  }

  async reactToHypothesis(id: string, dto: ReactToHypothesisDto, ctx: RequestContext): Promise<PublicDreamHypothesis> {
    const hypothesis = await this.getOwnHypothesis(id, ctx);

    if (dto.reaction === 'adjust') {
      if (!dto.adjustedText || dto.adjustedText.trim().length === 0) {
        throw new BadRequestException({
          error: { code: 'VALIDATION_ERROR', message: 'adjustの場合はadjustedTextが必須です' },
        });
      }
      const newVersion = await this.prisma.withRlsContext(ctx, async (tx) => {
        await tx.dreamHypothesis.update({
          where: { id },
          data: { userReaction: 'adjust', supersededAt: new Date() },
        });
        const created = await tx.dreamHypothesis.create({
          data: {
            employeeId: ctx.employeeId,
            clusterId: hypothesis.clusterId,
            version: hypothesis.version + 1,
            previousVersionId: hypothesis.id,
            hypothesisText: dto.adjustedText as string,
            source: 'user_stated',
            generationBasis: { adjustedFrom: hypothesis.id },
            status: 'provisional',
          },
        });
        await tx.dreamHypothesisRevisionLog.create({
          data: {
            dreamHypothesisId: hypothesis.id,
            newVersionId: created.id,
            triggerReason: 'member_initiated',
            diffSummary: '本人による修正',
          },
        });
        return created;
      });
      return toPublicHypothesis(newVersion);
    }

    const reaction = dto.reaction as 'agree' | 'reject' | 'undecided';
    const statusMap: Record<'agree' | 'reject' | 'undecided', DreamHypothesis['status']> = {
      agree: 'confirmed',
      reject: 'discontinued',
      undecided: hypothesis.status,
    };
    const updated = await this.prisma.withRlsContext(ctx, (tx) =>
      tx.dreamHypothesis.update({
        where: { id },
        data: { userReaction: reaction, status: statusMap[reaction] },
      }),
    );
    return toPublicHypothesis(updated);
  }

  async promoteToVision(hypothesisId: string, dto: PromoteToVisionDto, ctx: RequestContext): Promise<Vision> {
    const hypothesis = await this.getOwnHypothesis(hypothesisId, ctx);
    const content = dto.content ?? hypothesis.hypothesisText;

    return this.prisma.withRlsContext(ctx, async (tx) => {
      const vision = await tx.vision.create({
        data: {
          employeeId: ctx.employeeId,
          originDreamHypothesisId: hypothesis.id,
          content,
          source: 'user_stated',
          userApproved: true,
          status: 'confirmed',
        },
      });
      // Phase2 2.4節: 昇格元の仮説はアーカイブせず、confirmedのまま残す。
      await tx.dreamHypothesis.update({
        where: { id: hypothesis.id },
        data: { status: 'confirmed', linkedVisionId: vision.id },
      });
      return vision;
    });
  }

  async createVisionDirectly(dto: CreateVisionDto, ctx: RequestContext): Promise<Vision> {
    return this.prisma.withRlsContext(ctx, (tx) =>
      tx.vision.create({
        data: {
          employeeId: ctx.employeeId,
          content: dto.content,
          source: 'user_stated',
          userApproved: true,
          status: 'confirmed',
        },
      }),
    );
  }

  async listVisions(ctx: RequestContext): Promise<Vision[]> {
    return this.prisma.withRlsContext(ctx, (tx) =>
      tx.vision.findMany({ where: { employeeId: ctx.employeeId }, orderBy: { createdAt: 'desc' } }),
    );
  }

  async getVision(id: string, ctx: RequestContext): Promise<Vision> {
    const vision = await this.prisma.withRlsContext(ctx, (tx) => tx.vision.findUnique({ where: { id } }));
    if (!vision || vision.employeeId !== ctx.employeeId) {
      throw new NotFoundException({ error: { code: 'NOT_FOUND', message: 'Visionが見つかりません' } });
    }
    return vision;
  }
}
