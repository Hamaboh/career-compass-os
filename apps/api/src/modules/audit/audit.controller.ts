import { Controller, Get, Query } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

/**
 * Phase3 7.3節: audit_logsの閲覧は APP_MANAGEMENT（ADMIN限定）。
 * Phase4 10.3節の修正どおり、集計・ランキング機能はここに実装しない（生ログの検索・閲覧のみ）。
 */
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  @RequirePermission('APP_MANAGEMENT')
  async list(@Query('limit') limit?: string, @Query('cursor') cursor?: string) {
    const take = Math.min(Number(limit) || 50, 200);
    return this.auditLogService.list({ limit: take, cursor });
  }
}
