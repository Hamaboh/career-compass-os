import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  Competency,
  EvaluationPeriod,
  InstitutionalConnection,
  KpiMaster,
  Position,
  UlmMaster,
} from '@prisma/client';
import type { WhySubjectType } from '@career-compass/shared';
import { PrismaService } from '../../prisma/prisma.service';
import type { RequestContext } from '../../common/context/request-context';
import { AuditLogService } from '../audit/audit-log.service';
import { WhyService } from '../self-understanding/why/why.service';
import type { CreateKpiDto } from './dto/create-kpi.dto';
import type { CreateUlmDto } from './dto/create-ulm.dto';
import type { CreateInstitutionalConnectionDto } from './dto/create-institutional-connection.dto';
import type { CreateEvaluationPeriodDto } from './dto/create-evaluation-period.dto';
import type { CreateCompetencyDto } from './dto/create-competency.dto';
import type { CreatePositionDto } from './dto/create-position.dto';
import type { CreateInstitutionVersionDto, CreateUlmVersionDto } from './dto/create-institution-version.dto';

export interface PublishImpact {
  published: KpiMaster | UlmMaster;
  previousActiveArchived: KpiMaster | UlmMaster | null;
  /** 旧バージョンに接続されていたInstitutionalConnectionの件数（Phase4 10.2節「影響件数プレビュー」）。 */
  affectedConnectionCount: number;
}

/**
 * Phase2 §7〜9想定「制度接続」＋<implementation_scope> 12〜13番の実装本体。
 * <company_alignment>: 会社KPI/ULMは目標として設定してよいが、KPI/ULM→本人の成長→
 * 本人のキャリア→本人のWhy、という接続をできる限り確認する。growthNoteを必須入力とし、
 * whyReconfirmedをWhyService.isConvincing()から機械的に算出することで、この確認プロセスを
 * データ構造として強制する（InstitutionalConnectorAgent固有のAI呼び出しは本Stepでは
 * 実装しない。関連度判定は本人が明示的に選択する方式とした設計判断、完了報告に明記）。
 */
@Injectable()
export class InstitutionalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly why: WhyService,
  ) {}

  // ---- KPI Master（ADMIN管理、全員閲覧可） ----

  async createKpi(dto: CreateKpiDto, ctx: RequestContext): Promise<KpiMaster> {
    const kpi = await this.prisma.withRlsContext(ctx, (tx) =>
      tx.kpiMaster.create({ data: { title: dto.title, description: dto.description, status: 'active' } }),
    );
    await this.auditLog.record({
      actorEmployeeId: ctx.employeeId,
      actorType: 'human',
      action: 'kpi_master.create',
      targetType: 'kpi_master',
      targetId: kpi.id,
      after: { title: kpi.title },
      ipAddress: ctx.ipAddress,
    });
    return kpi;
  }

  async listKpis(ctx: RequestContext): Promise<KpiMaster[]> {
    // 一覧はfamilyごとに最新版のみを見せる（Phase3「(family)につきactiveは常に最大1件」の
    // UI表現。旧版はADM-07の「バージョン履歴」導線からlistKpiVersions()で辿る）。
    const all = await this.prisma.withRlsContext(ctx, (tx) =>
      tx.kpiMaster.findMany({ orderBy: [{ kpiFamilyId: 'asc' }, { versionNo: 'desc' }] }),
    );
    const seen = new Set<string>();
    return all.filter((k) => (seen.has(k.kpiFamilyId) ? false : (seen.add(k.kpiFamilyId), true)));
  }

  /** Phase3 5.B節「append-onlyバージョン管理」。改定履歴を新しい順に返す。 */
  async listKpiVersions(kpiFamilyId: string, ctx: RequestContext): Promise<KpiMaster[]> {
    return this.prisma.withRlsContext(ctx, (tx) =>
      tx.kpiMaster.findMany({ where: { kpiFamilyId }, orderBy: { versionNo: 'desc' } }),
    );
  }

  /**
   * 改定版を下書き(provisional)として追加する。既存のactive版はそのまま残り、
   * publishKpiVersion()するまで一般ユーザー向けには何も変わらない
   * （Phase3 §5.B不変条件「制度改定が既存の目標データを破壊しない」のUI表現）。
   */
  async createKpiVersion(kpiFamilyId: string, dto: CreateInstitutionVersionDto, ctx: RequestContext): Promise<KpiMaster> {
    const latest = await this.prisma.withRlsContext(ctx, (tx) =>
      tx.kpiMaster.findFirst({ where: { kpiFamilyId }, orderBy: { versionNo: 'desc' } }),
    );
    if (!latest) {
      throw new NotFoundException({ error: { code: 'NOT_FOUND', message: '対象のKPIが見つかりません' } });
    }
    const version = await this.prisma.withRlsContext(ctx, (tx) =>
      tx.kpiMaster.create({
        data: {
          kpiFamilyId,
          versionNo: latest.versionNo + 1,
          title: dto.title,
          description: dto.description,
          changeReason: dto.changeReason,
          status: 'provisional',
        },
      }),
    );
    await this.auditLog.record({
      actorEmployeeId: ctx.employeeId,
      actorType: 'human',
      action: 'kpi_master.create_version',
      targetType: 'kpi_master',
      targetId: version.id,
      before: { title: latest.title, versionNo: latest.versionNo },
      after: { title: version.title, versionNo: version.versionNo, changeReason: version.changeReason },
      ipAddress: ctx.ipAddress,
    });
    return version;
  }

  /**
   * 下書きを公開する。同一family内の旧active版はarchivedへ遷移させ、(family)につきactiveは
   * 常に最大1件というPhase3の不変条件を保つ。旧版に接続されていたInstitutionalConnectionの
   * 件数を返し、Phase4 10.2節「影響範囲プレビュー」をAPIレベルで支える
   * （実際の一括通知配信UIはフロントエンド側の実装対象）。
   */
  async publishKpiVersion(id: string, ctx: RequestContext): Promise<PublishImpact> {
    const target = await this.prisma.withRlsContext(ctx, (tx) => tx.kpiMaster.findUnique({ where: { id } }));
    if (!target) throw new NotFoundException({ error: { code: 'NOT_FOUND', message: '対象のKPIバージョンが見つかりません' } });

    const previousActive = await this.prisma.withRlsContext(ctx, (tx) =>
      tx.kpiMaster.findFirst({ where: { kpiFamilyId: target.kpiFamilyId, status: 'active' } }),
    );

    const [published, archived] = await this.prisma.withRlsContext(ctx, (tx) =>
      Promise.all([
        tx.kpiMaster.update({ where: { id }, data: { status: 'active' } }),
        previousActive && previousActive.id !== id
          ? tx.kpiMaster.update({ where: { id: previousActive.id }, data: { status: 'archived' } })
          : Promise.resolve(null),
      ]),
    );

    const affectedConnectionCount = previousActive
      ? await this.prisma.withSystemBypass((tx) =>
          tx.institutionalConnection.count({
            where: { institutionType: 'kpi', institutionId: previousActive.id },
          }),
        )
      : 0;

    await this.auditLog.record({
      actorEmployeeId: ctx.employeeId,
      actorType: 'human',
      action: 'kpi_master.publish',
      targetType: 'kpi_master',
      targetId: id,
      before: previousActive ? { activeVersionId: previousActive.id, versionNo: previousActive.versionNo } : null,
      after: { activeVersionId: published.id, versionNo: published.versionNo, affectedConnectionCount },
      ipAddress: ctx.ipAddress,
    });

    return { published, previousActiveArchived: archived, affectedConnectionCount };
  }

  // ---- ULM Master（ADMIN管理、全員閲覧可） ----

  async createUlm(dto: CreateUlmDto, ctx: RequestContext): Promise<UlmMaster> {
    const ulm = await this.prisma.withRlsContext(ctx, (tx) =>
      tx.ulmMaster.create({
        data: { unitId: dto.unitId, title: dto.title, description: dto.description, status: 'active' },
      }),
    );
    await this.auditLog.record({
      actorEmployeeId: ctx.employeeId,
      actorType: 'human',
      action: 'ulm_master.create',
      targetType: 'ulm_master',
      targetId: ulm.id,
      after: { title: ulm.title, unitId: ulm.unitId },
      ipAddress: ctx.ipAddress,
    });
    return ulm;
  }

  async listUlms(ctx: RequestContext): Promise<UlmMaster[]> {
    const all = await this.prisma.withRlsContext(ctx, (tx) =>
      tx.ulmMaster.findMany({ orderBy: [{ ulmFamilyId: 'asc' }, { versionNo: 'desc' }] }),
    );
    const seen = new Set<string>();
    return all.filter((u) => (seen.has(u.ulmFamilyId) ? false : (seen.add(u.ulmFamilyId), true)));
  }

  async listUlmVersions(ulmFamilyId: string, ctx: RequestContext): Promise<UlmMaster[]> {
    return this.prisma.withRlsContext(ctx, (tx) =>
      tx.ulmMaster.findMany({ where: { ulmFamilyId }, orderBy: { versionNo: 'desc' } }),
    );
  }

  async createUlmVersion(ulmFamilyId: string, dto: CreateUlmVersionDto, ctx: RequestContext): Promise<UlmMaster> {
    const latest = await this.prisma.withRlsContext(ctx, (tx) =>
      tx.ulmMaster.findFirst({ where: { ulmFamilyId }, orderBy: { versionNo: 'desc' } }),
    );
    if (!latest) {
      throw new NotFoundException({ error: { code: 'NOT_FOUND', message: '対象のULMが見つかりません' } });
    }
    const version = await this.prisma.withRlsContext(ctx, (tx) =>
      tx.ulmMaster.create({
        data: {
          ulmFamilyId,
          versionNo: latest.versionNo + 1,
          unitId: dto.unitId ?? latest.unitId,
          title: dto.title,
          description: dto.description,
          changeReason: dto.changeReason,
          status: 'provisional',
        },
      }),
    );
    await this.auditLog.record({
      actorEmployeeId: ctx.employeeId,
      actorType: 'human',
      action: 'ulm_master.create_version',
      targetType: 'ulm_master',
      targetId: version.id,
      before: { title: latest.title, versionNo: latest.versionNo },
      after: { title: version.title, versionNo: version.versionNo, changeReason: version.changeReason },
      ipAddress: ctx.ipAddress,
    });
    return version;
  }

  async publishUlmVersion(id: string, ctx: RequestContext): Promise<PublishImpact> {
    const target = await this.prisma.withRlsContext(ctx, (tx) => tx.ulmMaster.findUnique({ where: { id } }));
    if (!target) throw new NotFoundException({ error: { code: 'NOT_FOUND', message: '対象のULMバージョンが見つかりません' } });

    const previousActive = await this.prisma.withRlsContext(ctx, (tx) =>
      tx.ulmMaster.findFirst({ where: { ulmFamilyId: target.ulmFamilyId, status: 'active' } }),
    );

    const [published, archived] = await this.prisma.withRlsContext(ctx, (tx) =>
      Promise.all([
        tx.ulmMaster.update({ where: { id }, data: { status: 'active' } }),
        previousActive && previousActive.id !== id
          ? tx.ulmMaster.update({ where: { id: previousActive.id }, data: { status: 'archived' } })
          : Promise.resolve(null),
      ]),
    );

    const affectedConnectionCount = previousActive
      ? await this.prisma.withSystemBypass((tx) =>
          tx.institutionalConnection.count({
            where: { institutionType: 'ulm', institutionId: previousActive.id },
          }),
        )
      : 0;

    await this.auditLog.record({
      actorEmployeeId: ctx.employeeId,
      actorType: 'human',
      action: 'ulm_master.publish',
      targetType: 'ulm_master',
      targetId: id,
      before: previousActive ? { activeVersionId: previousActive.id, versionNo: previousActive.versionNo } : null,
      after: { activeVersionId: published.id, versionNo: published.versionNo, affectedConnectionCount },
      ipAddress: ctx.ipAddress,
    });

    return { published, previousActiveArchived: archived, affectedConnectionCount };
  }

  // ---- EvaluationPeriod / Competency / Position（ADM-06 人事評価制度管理、ADMIN管理・全員閲覧可） ----

  async createEvaluationPeriod(dto: CreateEvaluationPeriodDto, ctx: RequestContext): Promise<EvaluationPeriod> {
    const period = await this.prisma.withRlsContext(ctx, (tx) =>
      tx.evaluationPeriod.create({
        data: {
          id: dto.id,
          periodType: dto.periodType,
          periodStartDate: new Date(dto.periodStartDate),
          periodEndDate: new Date(dto.periodEndDate),
          periodLabel: dto.periodLabel,
        },
      }),
    );
    await this.auditLog.record({
      actorEmployeeId: ctx.employeeId,
      actorType: 'human',
      action: 'evaluation_period_master.create',
      targetType: 'evaluation_period_master',
      targetId: period.id,
      after: { periodLabel: period.periodLabel },
      ipAddress: ctx.ipAddress,
    });
    return period;
  }

  async listEvaluationPeriods(ctx: RequestContext): Promise<EvaluationPeriod[]> {
    return this.prisma.withRlsContext(ctx, (tx) =>
      tx.evaluationPeriod.findMany({ orderBy: { periodStartDate: 'desc' } }),
    );
  }

  async createCompetency(dto: CreateCompetencyDto, ctx: RequestContext): Promise<Competency> {
    const competency = await this.prisma.withRlsContext(ctx, (tx) =>
      tx.competency.create({ data: { competencyName: dto.competencyName } }),
    );
    await this.auditLog.record({
      actorEmployeeId: ctx.employeeId,
      actorType: 'human',
      action: 'competency_master.create',
      targetType: 'competency_master',
      targetId: competency.id,
      after: { competencyName: competency.competencyName },
      ipAddress: ctx.ipAddress,
    });
    return competency;
  }

  async listCompetencies(ctx: RequestContext): Promise<Competency[]> {
    return this.prisma.withRlsContext(ctx, (tx) => tx.competency.findMany({ orderBy: { competencyName: 'asc' } }));
  }

  async createPosition(dto: CreatePositionDto, ctx: RequestContext): Promise<Position> {
    const position = await this.prisma.withRlsContext(ctx, (tx) =>
      tx.position.create({ data: { positionName: dto.positionName, positionLevel: dto.positionLevel } }),
    );
    await this.auditLog.record({
      actorEmployeeId: ctx.employeeId,
      actorType: 'human',
      action: 'position_master.create',
      targetType: 'position_master',
      targetId: position.id,
      after: { positionName: position.positionName, positionLevel: position.positionLevel },
      ipAddress: ctx.ipAddress,
    });
    return position;
  }

  async listPositions(ctx: RequestContext): Promise<Position[]> {
    return this.prisma.withRlsContext(ctx, (tx) => tx.position.findMany({ orderBy: { positionLevel: 'asc' } }));
  }

  // ---- InstitutionalConnection ----

  async createConnection(dto: CreateInstitutionalConnectionDto, ctx: RequestContext): Promise<InstitutionalConnection> {
    await this.assertOwnsConnectable(dto.connectableType, dto.connectableId, ctx);
    await this.assertInstitutionActive(dto.institutionType, dto.institutionId, ctx);

    // <company_alignment>: キャリア→Whyの接続確認。対象オブジェクトに十分な確信度のWhyRecordが
    // 存在するかを機械的に検査する（WhySubjectTypeとInstitutionConnectableTypeは同じ文字列
    // 集合であるため変換不要）。
    const whyReconfirmed = await this.why.isConvincing(dto.connectableType as WhySubjectType, dto.connectableId, ctx);

    return this.prisma.withRlsContext(ctx, (tx) =>
      tx.institutionalConnection.create({
        data: {
          employeeId: ctx.employeeId,
          connectableType: dto.connectableType,
          connectableId: dto.connectableId,
          institutionType: dto.institutionType,
          institutionId: dto.institutionId,
          relevanceLabel: dto.relevanceLabel,
          growthNote: dto.growthNote,
          careerNote: dto.careerNote,
          whyReconfirmed,
          source: 'user_stated',
          userApproved: true,
          status: 'confirmed',
        },
      }),
    );
  }

  async listConnections(ctx: RequestContext): Promise<InstitutionalConnection[]> {
    return this.prisma.withRlsContext(ctx, (tx) =>
      tx.institutionalConnection.findMany({ where: { employeeId: ctx.employeeId }, orderBy: { createdAt: 'desc' } }),
    );
  }

  async listConnectionsForConnectable(
    connectableType: string,
    connectableId: string,
    ctx: RequestContext,
  ): Promise<InstitutionalConnection[]> {
    return this.prisma.withRlsContext(ctx, (tx) =>
      tx.institutionalConnection.findMany({
        where: { employeeId: ctx.employeeId, connectableType: connectableType as never, connectableId },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  private async assertOwnsConnectable(
    connectableType: CreateInstitutionalConnectionDto['connectableType'],
    connectableId: string,
    ctx: RequestContext,
  ): Promise<void> {
    const notFound = () =>
      new NotFoundException({ error: { code: 'NOT_FOUND', message: '接続対象のオブジェクトが見つかりません' } });
    if (connectableType === 'long_term_goal') {
      const g = await this.prisma.withRlsContext(ctx, (tx) => tx.longTermGoal.findUnique({ where: { id: connectableId } }));
      if (!g || g.employeeId !== ctx.employeeId) throw notFound();
    } else {
      const c = await this.prisma.withRlsContext(ctx, (tx) => tx.checkpoint.findUnique({ where: { id: connectableId } }));
      if (!c || c.employeeId !== ctx.employeeId) throw notFound();
    }
  }

  private async assertInstitutionActive(
    institutionType: CreateInstitutionalConnectionDto['institutionType'],
    institutionId: string,
    ctx: RequestContext,
  ): Promise<void> {
    const notFound = () =>
      new BadRequestException({ error: { code: 'VALIDATION_ERROR', message: '指定されたKPI/ULMが見つかりません' } });
    if (institutionType === 'kpi') {
      const kpi = await this.prisma.withRlsContext(ctx, (tx) => tx.kpiMaster.findUnique({ where: { id: institutionId } }));
      if (!kpi || kpi.status !== 'active') throw notFound();
    } else {
      const ulm = await this.prisma.withRlsContext(ctx, (tx) => tx.ulmMaster.findUnique({ where: { id: institutionId } }));
      if (!ulm || ulm.status !== 'active') throw notFound();
    }
  }
}
