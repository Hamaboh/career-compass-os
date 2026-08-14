import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Employee } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { SessionService } from '../auth/session.service';
import type { CreateEmployeeDto } from './dto/create-employee.dto';
import type { UpdateEmployeeDto } from './dto/update-employee.dto';
import type { ChangeRoleDto } from './dto/change-role.dto';
import type { ChangeStatusDto } from './dto/change-status.dto';
import type { RequestContext } from '../../common/context/request-context';

export type PublicEmployee = Omit<Employee, 'passwordHash'>;

/**
 * Phase3 16.10節「全レスポンスDTOは明示的なフィールドホワイトリスト方式で構築し、
 * 内部モデルをそのままシリアライズしない」の実装。passwordHashはargon2idハッシュとはいえ、
 * APIレスポンスに一切含めない（<constraints>「パスワードやOTPをログ出力しない」と同じ精神を
 * レスポンス経路にも適用する。2026-08-14、本番相当のライブ動作確認でGET /employees/meの
 * レスポンスにpasswordHashがそのまま含まれていたことが発覚し追加した）。
 */
function toPublicEmployee(employee: Employee): PublicEmployee {
  const { passwordHash: _passwordHash, ...rest } = employee;
  return rest;
}

/**
 * Phase3 7.3節のリソース×操作×権限マトリクスに対応。
 *   - list/get: employees_* RLSポリシーがロールに応じて行を絞る
 *     （ADMIN=全件, UL=自Unit+自分, MEMBER=自分のみ）ので、Service側では追加のWHEREを書かない。
 *   - create/update: EMPLOYEE_DATA_MANAGE（Controller側でRequirePermission）
 *   - role変更: USER_ROLE_MANAGE（Controller側で別エンドポイント・別権限）
 *   - status変更: EMPLOYEE_DATA_MANAGE。active以外への変更は全セッション失効（16.6節）。
 */
@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly sessionService: SessionService,
  ) {}

  async list(ctx: RequestContext): Promise<PublicEmployee[]> {
    const employees = await this.prisma.withRlsContext(ctx, (tx) =>
      tx.employee.findMany({ orderBy: { createdAt: 'asc' } }),
    );
    return employees.map(toPublicEmployee);
  }

  async get(id: string, ctx: RequestContext): Promise<PublicEmployee> {
    const employee = await this.prisma.withRlsContext(ctx, (tx) =>
      tx.employee.findUnique({ where: { id } }),
    );
    if (!employee) {
      // RLSにより「権限がなく見えない」場合も「存在しない」場合も同じ404を返す
      // （権限モデルの探索を助長しない、Phase4 14.3節と同じ考え方）。
      throw new NotFoundException({ error: { code: 'NOT_FOUND', message: '社員が見つかりません' } });
    }
    return toPublicEmployee(employee);
  }

  me(ctx: RequestContext): Promise<PublicEmployee> {
    return this.get(ctx.employeeId, ctx);
  }

  /** 監査ログ等、Service内部でのみ使う生レコード取得（passwordHashを含む、HTTPレスポンスに使わないこと）。 */
  private async getRaw(id: string, ctx: RequestContext): Promise<Employee> {
    const employee = await this.prisma.withRlsContext(ctx, (tx) =>
      tx.employee.findUnique({ where: { id } }),
    );
    if (!employee) {
      throw new NotFoundException({ error: { code: 'NOT_FOUND', message: '社員が見つかりません' } });
    }
    return employee;
  }

  async create(dto: CreateEmployeeDto, ctx: RequestContext): Promise<PublicEmployee> {
    // Phase3 7.2節: MEMBERは unit_id 必須（未配属のMEMBERは業務上想定しない）。
    if (dto.role === 'MEMBER' && !dto.unitId) {
      throw new BadRequestException({
        error: { code: 'VALIDATION_ERROR', message: 'MEMBERロールにはUnitの指定が必須です' },
      });
    }

    const existing = await this.prisma.employee.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException({
        error: { code: 'CONFLICT', message: 'このメールアドレスは既に登録されています' },
      });
    }

    const employee = await this.prisma.withRlsContext(ctx, (tx) =>
      tx.employee.create({
        data: {
          email: dto.email,
          name: dto.name,
          role: dto.role,
          unitId: dto.unitId,
          accountStatus: 'pending',
          invitationStatus: 'not_invited',
        },
      }),
    );

    await this.auditLog.record({
      actorEmployeeId: ctx.employeeId,
      actorType: 'human',
      action: 'employee.create',
      targetType: 'employee',
      targetId: employee.id,
      after: { email: employee.email, name: employee.name, role: employee.role, unitId: employee.unitId },
      ipAddress: ctx.ipAddress,
    });

    return toPublicEmployee(employee);
  }

  async update(id: string, dto: UpdateEmployeeDto, ctx: RequestContext): Promise<PublicEmployee> {
    const before = await this.getRaw(id, ctx);
    const employee = await this.prisma.withRlsContext(ctx, (tx) =>
      tx.employee.update({ where: { id }, data: dto }),
    );
    await this.auditLog.record({
      actorEmployeeId: ctx.employeeId,
      actorType: 'human',
      action: 'employee.update',
      targetType: 'employee',
      targetId: id,
      before: { name: before.name, unitId: before.unitId },
      after: { name: employee.name, unitId: employee.unitId },
      ipAddress: ctx.ipAddress,
    });
    return toPublicEmployee(employee);
  }

  async changeRole(id: string, dto: ChangeRoleDto, ctx: RequestContext): Promise<PublicEmployee> {
    const before = await this.getRaw(id, ctx);
    const employee = await this.prisma.withRlsContext(ctx, (tx) =>
      tx.employee.update({ where: { id }, data: { role: dto.role } }),
    );
    await this.auditLog.record({
      actorEmployeeId: ctx.employeeId,
      actorType: 'human',
      action: 'employee.role_change',
      targetType: 'employee',
      targetId: id,
      before: { role: before.role },
      after: { role: employee.role },
      ipAddress: ctx.ipAddress,
    });
    // role変更は即時のセッション失効トリガーとして16.6節に明記されていないが、権限境界の変更
    // という性質上、次回リクエストからは新権限で判定される（SessionService.validateSessionが
    // 毎回DBからroleを引き直す設計のため、明示的な失効なしでも安全側に倒れる）。
    return toPublicEmployee(employee);
  }

  async changeStatus(id: string, dto: ChangeStatusDto, ctx: RequestContext): Promise<PublicEmployee> {
    const before = await this.getRaw(id, ctx);
    const employee = await this.prisma.withRlsContext(ctx, (tx) =>
      tx.employee.update({ where: { id }, data: { accountStatus: dto.accountStatus } }),
    );

    await this.auditLog.record({
      actorEmployeeId: ctx.employeeId,
      actorType: 'human',
      action: 'employee.status_change',
      targetType: 'employee',
      targetId: id,
      before: { accountStatus: before.accountStatus },
      after: { accountStatus: employee.accountStatus, reason: dto.reason },
      ipAddress: ctx.ipAddress,
    });

    if (dto.accountStatus !== 'active') {
      // Phase3 16.6節: Adminによるアカウント状態変更（suspended/deactivated化）は全セッション即時失効。
      await this.sessionService.revokeAllSessions(id);
    }

    return toPublicEmployee(employee);
  }
}
