import { Injectable, NotFoundException } from '@nestjs/common';
import type { ReminderSchedule } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { RequestContext } from '../../common/context/request-context';
import type { CreateReminderDto } from './dto/create-reminder.dto';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * <reminder>要件。目標ごとに検証タイミングを設定できるようにし、期限だけでなく中間チェックや
 * 振り返りも対象にする。LongTermGoal確定時にtargetDateがあれば自動生成することで、
 * ULが手動で全員分のリマインダーを管理する必要がない設計にする（ReminderSchedulerが
 * 予約エージェント名として確保されているが、生成ロジック自体は日付計算のみでAI呼び出しを
 * 要しないため、ここでは決定的なコードロジックとして実装する）。
 */
@Injectable()
export class RemindersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * LongTermGoal/Checkpoint確定時に自動的に呼び出される。期限がある場合のみ、
   * 中間チェック（今日と期限の中間地点）・期限当日・振り返り（期限の3日後）の
   * 3件を生成する。期限がない、または既に過ぎている場合は何もしない。
   */
  async autoScheduleForGoal(
    subject: { id: string; employeeId: string; targetDate: Date | null; kind?: 'long_term_goal' | 'checkpoint' },
    ctx: RequestContext,
  ): Promise<void> {
    if (!subject.targetDate) return;
    const now = new Date();
    const target = subject.targetDate;
    if (target.getTime() <= now.getTime()) return;

    const midpoint = new Date(now.getTime() + (target.getTime() - now.getTime()) / 2);
    const reflectionDate = new Date(target.getTime() + 3 * MS_PER_DAY);
    const linkField =
      (subject.kind ?? 'long_term_goal') === 'checkpoint'
        ? { checkpointId: subject.id }
        : { longTermGoalId: subject.id };

    await this.prisma.withRlsContext(ctx, (tx) =>
      Promise.all([
        tx.reminderSchedule.create({
          data: { employeeId: subject.employeeId, ...linkField, triggerType: 'interim_check', scheduledAt: midpoint },
        }),
        tx.reminderSchedule.create({
          data: { employeeId: subject.employeeId, ...linkField, triggerType: 'deadline', scheduledAt: target },
        }),
        tx.reminderSchedule.create({
          data: {
            employeeId: subject.employeeId,
            ...linkField,
            triggerType: 'reflection',
            scheduledAt: reflectionDate,
          },
        }),
      ]),
    );
  }

  /** 本人による任意の検証タイミングの追加（自動生成分を補う）。 */
  async createManual(dto: CreateReminderDto, ctx: RequestContext): Promise<ReminderSchedule> {
    if (dto.longTermGoalId) {
      const g = await this.prisma.withRlsContext(ctx, (tx) => tx.longTermGoal.findUnique({ where: { id: dto.longTermGoalId } }));
      if (!g || g.employeeId !== ctx.employeeId) {
        throw new NotFoundException({ error: { code: 'NOT_FOUND', message: '長期目標が見つかりません' } });
      }
    }
    if (dto.checkpointId) {
      const c = await this.prisma.withRlsContext(ctx, (tx) => tx.checkpoint.findUnique({ where: { id: dto.checkpointId } }));
      if (!c || c.employeeId !== ctx.employeeId) {
        throw new NotFoundException({ error: { code: 'NOT_FOUND', message: '通過点が見つかりません' } });
      }
    }
    return this.prisma.withRlsContext(ctx, (tx) =>
      tx.reminderSchedule.create({
        data: {
          employeeId: ctx.employeeId,
          longTermGoalId: dto.longTermGoalId,
          checkpointId: dto.checkpointId,
          triggerType: dto.triggerType,
          scheduledAt: new Date(dto.scheduledAt),
        },
      }),
    );
  }

  async listMine(ctx: RequestContext): Promise<ReminderSchedule[]> {
    return this.prisma.withRlsContext(ctx, (tx) =>
      tx.reminderSchedule.findMany({ where: { employeeId: ctx.employeeId }, orderBy: { scheduledAt: 'asc' } }),
    );
  }

  /** 予定時刻が到来済みでまだ完了・スキップされていないもの。継続支援AIの起点として使う。 */
  async listDue(ctx: RequestContext): Promise<ReminderSchedule[]> {
    return this.prisma.withRlsContext(ctx, (tx) =>
      tx.reminderSchedule.findMany({
        where: { employeeId: ctx.employeeId, status: { in: ['pending', 'due'] }, scheduledAt: { lte: new Date() } },
        orderBy: { scheduledAt: 'asc' },
      }),
    );
  }

  private async getOwn(id: string, ctx: RequestContext): Promise<ReminderSchedule> {
    const r = await this.prisma.withRlsContext(ctx, (tx) => tx.reminderSchedule.findUnique({ where: { id } }));
    if (!r || r.employeeId !== ctx.employeeId) {
      throw new NotFoundException({ error: { code: 'NOT_FOUND', message: 'リマインダーが見つかりません' } });
    }
    return r;
  }

  async markCompleted(id: string, ctx: RequestContext): Promise<ReminderSchedule> {
    await this.getOwn(id, ctx);
    return this.prisma.withRlsContext(ctx, (tx) =>
      tx.reminderSchedule.update({ where: { id }, data: { status: 'completed', completedAt: new Date() } }),
    );
  }

  async markSkipped(id: string, ctx: RequestContext): Promise<ReminderSchedule> {
    await this.getOwn(id, ctx);
    return this.prisma.withRlsContext(ctx, (tx) => tx.reminderSchedule.update({ where: { id }, data: { status: 'skipped' } }));
  }
}
