import { RemindersService } from './reminders.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { RequestContext } from '../../common/context/request-context';

/**
 * <reminder>要件。「ULが手動で全員のリマインダーを管理する必要がない設計」の中核である
 * 自動スケジューリングの日付計算ロジックを検証する。
 */
describe('RemindersService.autoScheduleForGoal', () => {
  const ctx: RequestContext = { employeeId: 'emp-1', role: 'MEMBER', unitId: null, ipAddress: null };

  function makePrismaMock() {
    const created: { data: Record<string, unknown> }[] = [];
    const tx = {
      reminderSchedule: {
        create: (args: { data: Record<string, unknown> }) => {
          created.push(args);
          return Promise.resolve(args.data);
        },
      },
    };
    const prisma = {
      withRlsContext: async (_ctx: RequestContext, fn: (tx: unknown) => unknown) => fn(tx),
    } as unknown as PrismaService;
    return { prisma, created };
  }

  it('期限が未来にある場合、中間チェック・期限・振り返りの3件を生成する', async () => {
    const { prisma, created } = makePrismaMock();
    const service = new RemindersService(prisma);
    const targetDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000); // 10日後

    await service.autoScheduleForGoal({ id: 'goal-1', employeeId: 'emp-1', targetDate }, ctx);

    expect(created).toHaveLength(3);
    const triggerTypes = created.map((c) => c.data.triggerType);
    expect(triggerTypes).toEqual(['interim_check', 'deadline', 'reflection']);

    const deadlineEntry = created.find((c) => c.data.triggerType === 'deadline')!;
    expect(deadlineEntry.data.scheduledAt).toBe(targetDate);

    const interimEntry = created.find((c) => c.data.triggerType === 'interim_check')!;
    const interimDate = interimEntry.data.scheduledAt as Date;
    expect(interimDate.getTime()).toBeGreaterThan(Date.now());
    expect(interimDate.getTime()).toBeLessThan(targetDate.getTime());

    const reflectionEntry = created.find((c) => c.data.triggerType === 'reflection')!;
    const reflectionDate = reflectionEntry.data.scheduledAt as Date;
    expect(reflectionDate.getTime()).toBeGreaterThan(targetDate.getTime());
  });

  it('期限がnullの場合は何も生成しない', async () => {
    const { prisma, created } = makePrismaMock();
    const service = new RemindersService(prisma);

    await service.autoScheduleForGoal({ id: 'goal-1', employeeId: 'emp-1', targetDate: null }, ctx);

    expect(created).toHaveLength(0);
  });

  it('期限が既に過ぎている場合は何も生成しない（無意味なリマインダーを作らない）', async () => {
    const { prisma, created } = makePrismaMock();
    const service = new RemindersService(prisma);
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

    await service.autoScheduleForGoal({ id: 'goal-1', employeeId: 'emp-1', targetDate: pastDate }, ctx);

    expect(created).toHaveLength(0);
  });

  it('Checkpointの場合はcheckpointIdで生成する（longTermGoalIdは設定しない）', async () => {
    const { prisma, created } = makePrismaMock();
    const service = new RemindersService(prisma);
    const targetDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);

    await service.autoScheduleForGoal(
      { id: 'cp-1', employeeId: 'emp-1', targetDate, kind: 'checkpoint' },
      ctx,
    );

    expect(created).toHaveLength(3);
    for (const c of created) {
      expect(c.data.checkpointId).toBe('cp-1');
      expect(c.data.longTermGoalId).toBeUndefined();
    }
  });
});
