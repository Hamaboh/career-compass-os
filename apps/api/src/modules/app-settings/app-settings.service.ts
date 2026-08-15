import { Injectable } from '@nestjs/common';
import type { AppSetting } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { RequestContext } from '../../common/context/request-context';
import { AuditLogService } from '../audit/audit-log.service';
import type { UpdateAppSettingsDto } from './dto/update-app-settings.dto';

const SINGLETON_ID = 'default';

/**
 * ADM-09「アプリ設定」の実装本体。Phase3の62テーブル一覧には存在しない新規テーブル
 * （app_settings、schema.prismaのモデル定義コメントに理由を明記）。
 * シングルトン運用: 1行のみが存在し、なければ既定値で自動作成する（本人が意識せず使える）。
 */
@Injectable()
export class AppSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  /**
   * app_settingsのRLSは authenticated_select(全員SELECT可) / admin_all(ADMINのみ書き込み可)
   * の2ポリシー構成のため、シングルトン行がまだ存在しない状態でMEMBER/ULが最初にGETした場合、
   * 本人のRLSコンテキストでは行を作成できない（正しい挙動、ADMIN以外に書き込み権限を与えない
   * という設計そのもの）。そのため「まだ存在しないので既定値で作る」という初期化操作自体は
   * ロールに関わらずシステムが行う下準備とみなし、withSystemBypass()で行う
   * （読み取り自体は引き続きctxのRLSコンテキストで行う）。
   */
  async get(ctx: RequestContext): Promise<AppSetting> {
    const existing = await this.prisma.withRlsContext(ctx, (tx) =>
      tx.appSetting.findUnique({ where: { id: SINGLETON_ID } }),
    );
    if (existing) return existing;
    return this.prisma.withSystemBypass((tx) => tx.appSetting.create({ data: { id: SINGLETON_ID } }));
  }

  async update(dto: UpdateAppSettingsDto, ctx: RequestContext): Promise<AppSetting> {
    const before = await this.get(ctx);
    const updated = await this.prisma.withRlsContext(ctx, (tx) =>
      tx.appSetting.upsert({
        where: { id: SINGLETON_ID },
        create: { id: SINGLETON_ID, ...dto, updatedByEmployeeId: ctx.employeeId },
        update: { ...dto, updatedByEmployeeId: ctx.employeeId },
      }),
    );
    await this.auditLog.record({
      actorEmployeeId: ctx.employeeId,
      actorType: 'human',
      action: 'app_settings.update',
      targetType: 'app_settings',
      targetId: SINGLETON_ID,
      before: { ...before },
      after: { ...updated },
      ipAddress: ctx.ipAddress,
    });
    return updated;
  }
}
