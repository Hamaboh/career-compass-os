import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootstrapTestApp } from './utils/bootstrap-test-app';
import { MockAiOrchestrationService } from './utils/mock-ai-orchestration.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { hashPassword } from '../src/common/security/password-hash';
import { AiOrchestrationService } from '../src/modules/ai-orchestration/ai-orchestration.service';
import { NotificationsService } from '../src/modules/notifications/notifications.service';

/**
 * MVP完成フェーズで追加した通知センター(<notification>)・アプリ設定(ADM-09)・
 * 人事評価制度マスタ(ADM-06)のe2eテスト。重点的に検証するのは:
 *   - <notification>: sweepAndGenerate()が生成した通知は受信者本人にしか見えないこと、
 *     既読化が本人操作のみで可能なこと
 *   - ADM-09/ADM-06: COMPANY_POLICY_MANAGE/APP_SETTINGS_EDIT権限を持たないロール
 *     (MEMBER/UL)からの書き込みがAPIレベルで403になること（RBAC徹底）
 */
jest.setTimeout(120000);

describe('MVP完成フェーズ: 通知/アプリ設定/人事評価制度マスタ (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const password = 'TestPass123!';
  const suffix = Date.now();
  const ids: Record<string, string> = {};

  async function seedEmployee(key: string, role: 'ADMIN' | 'UL' | 'MEMBER', unitId?: string) {
    const passwordHash = await hashPassword(password);
    const employee = await prisma.withSystemBypass((tx) =>
      tx.employee.create({
        data: {
          email: `${key}-${suffix}@example.com`,
          name: key,
          role,
          unitId,
          accountStatus: 'active',
          invitationStatus: 'activated',
          passwordHash,
        },
      }),
    );
    ids[key] = employee.id;
  }

  async function login(key: string): Promise<{ cookie: string; csrfToken: string }> {
    const res = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: `${key}-${suffix}@example.com`, password })
      .expect(200);
    const cookies = res.get('Set-Cookie')!;
    const sessionCookie = cookies.find((c) => c.startsWith('__Host-session='))!.split(';')[0];
    const csrfCookie = cookies.find((c) => c.startsWith('csrf_token='))!.split(';')[0];
    return { cookie: `${sessionCookie}; ${csrfCookie}`, csrfToken: csrfCookie.split('=')[1] };
  }

  beforeAll(async () => {
    app = await bootstrapTestApp((builder) =>
      builder.overrideProvider(AiOrchestrationService).useClass(MockAiOrchestrationService),
    );
    prisma = app.get(PrismaService);

    const unit = await prisma.unit.create({ data: { name: `MvpCompletionUnit-${suffix}` } });
    ids.unit = unit.id;
    await seedEmployee('admin', 'ADMIN');
    await seedEmployee('ul', 'UL', unit.id);
    await seedEmployee('memberA', 'MEMBER', unit.id);
    await seedEmployee('memberB', 'MEMBER', unit.id);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('<notification>: 通知センターは受信者本人にしか見えない', () => {
    let memberA: { cookie: string; csrfToken: string };
    let memberB: { cookie: string; csrfToken: string };
    let notificationId: string;

    beforeAll(async () => {
      memberA = await login('memberA');
      memberB = await login('memberB');

      // sweepAndGenerate()相当の通知を直接作成する（本番ではworker.tsが定期的に呼び出す）。
      await prisma.withSystemBypass((tx) =>
        tx.notification.create({
          data: {
            recipientEmployeeId: ids.memberA,
            notificationType: 'action_due',
            title: 'テスト通知',
            body: '行動の予定日になりました。',
            relatedType: 'action',
            relatedId: ids.memberA,
            channel: 'in_app',
          },
        }),
      );
      const list = await request(app.getHttpServer())
        .get('/v1/notifications')
        .set('Cookie', memberA.cookie)
        .expect(200);
      notificationId = list.body[0].id;
    });

    it('memberAは自分宛ての通知を閲覧できる', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/notifications')
        .set('Cookie', memberA.cookie)
        .expect(200);
      expect(res.body.some((n: { id: string }) => n.id === notificationId)).toBe(true);
    });

    it('memberBはmemberA宛ての通知を既読化できない(404)', async () => {
      await request(app.getHttpServer())
        .patch(`/v1/notifications/${notificationId}/read`)
        .set('Cookie', memberB.cookie)
        .set('X-CSRF-Token', memberB.csrfToken)
        .send({})
        .expect(404);
    });

    it('memberBの一覧にはmemberA宛ての通知が含まれない', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/notifications')
        .set('Cookie', memberB.cookie)
        .expect(200);
      expect(res.body.some((n: { id: string }) => n.id === notificationId)).toBe(false);
    });

    it('memberAが既読化すると readAt が設定される', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/v1/notifications/${notificationId}/read`)
        .set('Cookie', memberA.cookie)
        .set('X-CSRF-Token', memberA.csrfToken)
        .send({})
        .expect(200);
      expect(res.body.readAt).not.toBeNull();
    });

    it('sweepAndGenerate()は期限到来したActionを検知し、2回実行しても重複しない(冪等性)', async () => {
      const notifications = app.get(NotificationsService);
      // actionsはself=FOR ALL/UL=SELECT/ADMIN=SELECTの3層RLS（既存ドメインと同じ設計）のため、
      // withSystemBypass(role=ADMIN扱い)では書き込めない。本人(memberB)自身のRLSコンテキストで作成する。
      const action = await prisma.withRlsContext(
        { employeeId: ids.memberB, role: 'MEMBER', unitId: ids.unit, ipAddress: null },
        (tx) =>
          tx.action.create({
            data: {
              employeeId: ids.memberB,
              title: `テスト行動-${suffix}`,
              dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // 昨日が期限=既に到来
              status: 'not_started',
              source: 'user_stated',
              userApproved: true,
            },
          }),
      );

      await notifications.sweepAndGenerate();
      await notifications.sweepAndGenerate();

      const created = await prisma.withSystemBypass((tx) =>
        tx.notification.findMany({
          where: { relatedType: 'action', relatedId: action.id, notificationType: 'action_due' },
        }),
      );
      expect(created).toHaveLength(1);
      expect(created[0].recipientEmployeeId).toBe(ids.memberB);
    });
  });

  describe('ADM-09: アプリ設定はAPP_SETTINGS_EDIT権限(ADMINのみ)でしか変更できない', () => {
    it('MEMBERは閲覧できる', async () => {
      const memberA = await login('memberA');
      await request(app.getHttpServer()).get('/v1/app-settings').set('Cookie', memberA.cookie).expect(200);
    });

    it('MEMBERは変更できない(403)', async () => {
      const memberA = await login('memberA');
      await request(app.getHttpServer())
        .patch('/v1/app-settings')
        .set('Cookie', memberA.cookie)
        .set('X-CSRF-Token', memberA.csrfToken)
        .send({ defaultInterimCheckDays: 7 })
        .expect(403);
    });

    it('ULは変更できない(403)', async () => {
      const ul = await login('ul');
      await request(app.getHttpServer())
        .patch('/v1/app-settings')
        .set('Cookie', ul.cookie)
        .set('X-CSRF-Token', ul.csrfToken)
        .send({ defaultInterimCheckDays: 7 })
        .expect(403);
    });

    it('ADMINは変更でき、値が永続化される', async () => {
      const admin = await login('admin');
      const res = await request(app.getHttpServer())
        .patch('/v1/app-settings')
        .set('Cookie', admin.cookie)
        .set('X-CSRF-Token', admin.csrfToken)
        .send({ defaultInterimCheckDays: 21 })
        .expect(200);
      expect(res.body.defaultInterimCheckDays).toBe(21);

      const getRes = await request(app.getHttpServer())
        .get('/v1/app-settings')
        .set('Cookie', admin.cookie)
        .expect(200);
      expect(getRes.body.defaultInterimCheckDays).toBe(21);
    });
  });

  describe('ADM-06: 人事評価制度マスタはCOMPANY_POLICY_MANAGE権限(ADMINのみ)でしか登録できない', () => {
    it('MEMBERは評価期間マスタを作成できない(403)', async () => {
      const memberA = await login('memberA');
      await request(app.getHttpServer())
        .post('/v1/evaluation-periods')
        .set('Cookie', memberA.cookie)
        .set('X-CSRF-Token', memberA.csrfToken)
        .send({
          id: `FY-TEST-${suffix}`,
          periodType: 'half_year',
          periodStartDate: '2026-04-01',
          periodEndDate: '2026-09-30',
          periodLabel: 'テスト期間',
        })
        .expect(403);
    });

    it('ADMINは評価期間・能力・職位マスタを作成でき、全ロールが閲覧できる', async () => {
      const admin = await login('admin');
      await request(app.getHttpServer())
        .post('/v1/evaluation-periods')
        .set('Cookie', admin.cookie)
        .set('X-CSRF-Token', admin.csrfToken)
        .send({
          id: `FY-TEST-${suffix}`,
          periodType: 'half_year',
          periodStartDate: '2026-04-01',
          periodEndDate: '2026-09-30',
          periodLabel: 'テスト期間',
        })
        .expect(201);

      await request(app.getHttpServer())
        .post('/v1/competency-master')
        .set('Cookie', admin.cookie)
        .set('X-CSRF-Token', admin.csrfToken)
        .send({ competencyName: `課題解決力-${suffix}` })
        .expect(201);

      await request(app.getHttpServer())
        .post('/v1/position-master')
        .set('Cookie', admin.cookie)
        .set('X-CSRF-Token', admin.csrfToken)
        .send({ positionName: `シニアエンジニア-${suffix}`, positionLevel: 3 })
        .expect(201);

      const memberA = await login('memberA');
      const periods = await request(app.getHttpServer())
        .get('/v1/evaluation-periods')
        .set('Cookie', memberA.cookie)
        .expect(200);
      expect(periods.body.some((p: { id: string }) => p.id === `FY-TEST-${suffix}`)).toBe(true);
    });
  });

  describe('ADMINが社員情報を編集できる一方、ULは編集できない(EMPLOYEE_DATA_MANAGE)', () => {
    it('ULはmemberAの氏名を編集できない(403)', async () => {
      const ul = await login('ul');
      await request(app.getHttpServer())
        .patch(`/v1/employees/${ids.memberA}`)
        .set('Cookie', ul.cookie)
        .set('X-CSRF-Token', ul.csrfToken)
        .send({ name: 'ULによる不正な変更' })
        .expect(403);
    });

    it('ADMINはmemberAの氏名を編集でき、変更が反映される', async () => {
      const admin = await login('admin');
      const newName = `memberA-renamed-${suffix}`;
      const res = await request(app.getHttpServer())
        .patch(`/v1/employees/${ids.memberA}`)
        .set('Cookie', admin.cookie)
        .set('X-CSRF-Token', admin.csrfToken)
        .send({ name: newName })
        .expect(200);
      expect(res.body.name).toBe(newName);
      expect(res.body).not.toHaveProperty('passwordHash');
    });
  });
});
