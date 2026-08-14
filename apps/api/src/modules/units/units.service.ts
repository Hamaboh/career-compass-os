import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import type { CreateUnitDto } from './dto/create-unit.dto';
import type { UpdateUnitDto } from './dto/update-unit.dto';
import type { RequestContext } from '../../common/context/request-context';

/**
 * Phase3 7.3節: units の作成・編集は EMPLOYEE_DATA_MANAGE（ADMIN限定、Controllerで強制）。
 * 閲覧は組織構造の基礎情報として全ロール共通（Unit名等に機微性はないため）。
 * unitsテーブル自体はRLS対象外（Unit横断の一覧を出す性質上、行レベルで絞る必要がない）。
 */
@Injectable()
export class UnitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  list() {
    return this.prisma.unit.findMany({ orderBy: { createdAt: 'asc' } });
  }

  async get(id: string) {
    const unit = await this.prisma.unit.findUnique({ where: { id } });
    if (!unit) throw new NotFoundException({ error: { code: 'NOT_FOUND', message: 'Unitが見つかりません' } });
    return unit;
  }

  async create(dto: CreateUnitDto, ctx: RequestContext) {
    const unit = await this.prisma.unit.create({ data: dto });
    await this.auditLog.record({
      actorEmployeeId: ctx.employeeId,
      actorType: 'human',
      action: 'unit.create',
      targetType: 'unit',
      targetId: unit.id,
      after: unit,
      ipAddress: ctx.ipAddress,
    });
    return unit;
  }

  async update(id: string, dto: UpdateUnitDto, ctx: RequestContext) {
    const before = await this.get(id);
    const unit = await this.prisma.unit.update({ where: { id }, data: dto });
    await this.auditLog.record({
      actorEmployeeId: ctx.employeeId,
      actorType: 'human',
      action: 'unit.update',
      targetType: 'unit',
      targetId: unit.id,
      before,
      after: unit,
      ipAddress: ctx.ipAddress,
    });
    return unit;
  }
}
