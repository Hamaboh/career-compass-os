import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootstrapTestApp } from './utils/bootstrap-test-app';
import { MockMailService } from './utils/mock-mail.service';
import { MailService } from '../src/modules/mail/mail.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { hashPassword } from '../src/common/security/password-hash';

/**
 * Phase3 9〜12章の招待→OTP→パスワード設定→ログインの一連のフローを、実際のPostgres/Redis
 * （career_compass_test / RedisのDB index 1、Docker Composeで起動中のもの）に対して検証する。
 * SMTP実送信は行わず、MockMailServiceで本文を捕捉してOTP/招待トークンを取り出す。
 */
// 他のe2eスペックと同じ理由（アプリ全体のブートストラップが環境依存でJestデフォルトの
// 30秒を超えることがある）でタイムアウトを緩める。MVP完成フェーズでAppModuleに
// モジュールが増えたことでブートストラップ時間が伸び、本フェーズで初めて発現した
// （このファイルだけ後から追加されたモジュール群を含む起動コストの影響を受けていなかった）。
jest.setTimeout(120000);

describe('Auth flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let mail: MockMailService;
  const adminEmail = `admin-${Date.now()}@example.com`;
  const adminPassword = 'AdminPass123!';

  beforeAll(async () => {
    app = await bootstrapTestApp((builder) =>
      builder.overrideProvider(MailService).useClass(MockMailService),
    );
    prisma = app.get(PrismaService);
    mail = app.get(MailService) as unknown as MockMailService;

    // Phase3 7.2節: 初期ADMINはシードデータとして作成する（招待フローを経ない）。
    const adminPasswordHash = await hashPassword(adminPassword);
    await prisma.withSystemBypass((tx) =>
      tx.employee.create({
        data: {
          email: adminEmail,
          name: 'E2E Admin',
          role: 'ADMIN',
          accountStatus: 'active',
          invitationStatus: 'activated',
          passwordHash: adminPasswordHash,
        },
      }),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  function extractLinkToken(text: string): string {
    const match = text.match(/\/(?:invitations|password-reset)\/([\w-]+)/);
    if (!match) throw new Error(`token not found in mail body: ${text}`);
    return match[1];
  }

  function extractOtp(text: string): string {
    const match = text.match(/認証コード: (\d{6})/);
    if (!match) throw new Error(`otp not found in mail body: ${text}`);
    return match[1];
  }

  it('admin logs in and receives a session + CSRF cookie', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: adminEmail, password: adminPassword })
      .expect(200);

    const cookies = res.get('Set-Cookie') ?? [];
    expect(cookies.some((c) => c.startsWith('__Host-session='))).toBe(true);
    expect(cookies.some((c) => c.startsWith('csrf_token='))).toBe(true);
  });

  it('rejects wrong password with a generic 401 message', async () => {
    await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: adminEmail, password: 'wrong-password' })
      .expect(401)
      .expect((res) => {
        expect(res.body.error.message).toBe('メールアドレスまたはパスワードが正しくありません');
      });
  });

  describe('full invitation → OTP → password → login flow', () => {
    let sessionCookie: string;
    let csrfToken: string;
    let newEmployeeId: string;
    let invitationToken: string;
    const memberEmail = `member-${Date.now()}@example.com`;
    const memberPassword = 'MemberPass123!';

    beforeAll(async () => {
      const login = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: adminEmail, password: adminPassword })
        .expect(200);
      const cookies = login.get('Set-Cookie')!;
      sessionCookie = cookies.find((c) => c.startsWith('__Host-session='))!.split(';')[0];
      const csrfCookie = cookies.find((c) => c.startsWith('csrf_token='))!.split(';')[0];
      csrfToken = csrfCookie.split('=')[1];
      // supertestは自動でCookieを保持しないため、Double Submit Cookieの検証に必要な
      // csrf_token Cookie自体も明示的に(セッションCookieと合わせて)毎回送る。
      sessionCookie = `${sessionCookie}; ${csrfCookie}`;
    });

    it('ADMIN creates a unit and a MEMBER employee', async () => {
      const unitRes = await request(app.getHttpServer())
        .post('/v1/units')
        .set('Cookie', sessionCookie)
        .set('X-CSRF-Token', csrfToken)
        .send({ name: 'E2Eテストユニット' })
        .expect(201);

      const employeeRes = await request(app.getHttpServer())
        .post('/v1/employees')
        .set('Cookie', sessionCookie)
        .set('X-CSRF-Token', csrfToken)
        .send({ email: memberEmail, name: 'E2E Member', role: 'MEMBER', unitId: unitRes.body.id })
        .expect(201);

      newEmployeeId = employeeRes.body.id;
      expect(employeeRes.body.accountStatus).toBe('pending');
    });

    it('rejects the same request without a matching CSRF token', async () => {
      await request(app.getHttpServer())
        .post('/v1/units')
        .set('Cookie', sessionCookie)
        .set('X-CSRF-Token', 'wrong-token')
        .send({ name: '拒否されるはず' })
        .expect(403);
    });

    it('MEMBER cannot create employees (RBAC)', async () => {
      // まだ招待前でパスワードがないため、通常ログインはできない。RBAC自体は
      // PermissionsGuardのロジックとして別途unitテストで検証済み（common/guards配下）。
      // ここではADMIN以外のロールにEMPLOYEE_DATA_MANAGEがないことをpackages/sharedの
      // hasPermission()経由で直接確認する（統合テストとして冗長にならない範囲で）。
      const { hasPermission } = await import('@career-compass/shared');
      expect(hasPermission('MEMBER', 'EMPLOYEE_DATA_MANAGE')).toBe(false);
      expect(hasPermission('UL', 'EMPLOYEE_DATA_MANAGE')).toBe(false);
      expect(hasPermission('ADMIN', 'EMPLOYEE_DATA_MANAGE')).toBe(true);
    });

    it('ADMIN issues an invitation and the mail contains a token link', async () => {
      await request(app.getHttpServer())
        .post('/v1/invitations')
        .set('Cookie', sessionCookie)
        .set('X-CSRF-Token', csrfToken)
        .send({ employeeId: newEmployeeId })
        .expect(201);

      const invitationMail = mail.latestFor(memberEmail);
      expect(invitationMail).toBeDefined();
      invitationToken = extractLinkToken(invitationMail!.text);
    });

    it('invitee opens the invitation link', async () => {
      const res = await request(app.getHttpServer())
        .get(`/v1/invitations/${invitationToken}`)
        .expect(200);
      expect(res.body.email).toBe(memberEmail);
      expect(res.body.role).toBe('MEMBER');
    });

    it('rejects OTP verification before an OTP has been sent', async () => {
      await request(app.getHttpServer())
        .post(`/v1/invitations/${invitationToken}/verify-otp`)
        .send({ code: '000000' })
        .expect(400);
    });

    let otp: string;

    it('sends an OTP and does not leak it in the audit log', async () => {
      await request(app.getHttpServer())
        .post(`/v1/invitations/${invitationToken}/send-otp`)
        .expect(201);

      const otpMail = mail.latestFor(memberEmail);
      expect(otpMail).toBeDefined();
      otp = extractOtp(otpMail!.text);

      const logs = await prisma.auditLog.findMany({ where: { action: 'invitation.otp_sent' } });
      const serialized = JSON.stringify(logs);
      expect(serialized).not.toContain(otp);
    });

    it('rejects an incorrect OTP without revealing remaining attempts', async () => {
      const res = await request(app.getHttpServer())
        .post(`/v1/invitations/${invitationToken}/verify-otp`)
        .send({ code: '999999' })
        .expect(400);
      expect(res.body.error.message).toBe('コードが正しくありません');
    });

    it('accepts the correct OTP', async () => {
      await request(app.getHttpServer())
        .post(`/v1/invitations/${invitationToken}/verify-otp`)
        .send({ code: otp })
        .expect(201);
    });

    it('rejects a weak password (policy enforcement)', async () => {
      await request(app.getHttpServer())
        .post(`/v1/invitations/${invitationToken}/set-password`)
        .send({ password: 'short', passwordConfirmation: 'short' })
        .expect(400);
    });

    it('rejects mismatched password confirmation', async () => {
      await request(app.getHttpServer())
        .post(`/v1/invitations/${invitationToken}/set-password`)
        .send({ password: memberPassword, passwordConfirmation: 'somethingElse123' })
        .expect(400);
    });

    it('sets the password, activates the account, and auto-logs in', async () => {
      const res = await request(app.getHttpServer())
        .post(`/v1/invitations/${invitationToken}/set-password`)
        .send({ password: memberPassword, passwordConfirmation: memberPassword })
        .expect(201);

      expect(res.body.role).toBe('MEMBER');
      const cookies = res.get('Set-Cookie') ?? [];
      expect(cookies.some((c) => c.startsWith('__Host-session='))).toBe(true);
    });

    it('the new MEMBER can now log in normally with the chosen password', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: memberEmail, password: memberPassword })
        .expect(200);
    });

    it('never stored the password in plaintext', async () => {
      const employee = await prisma.withSystemBypass((tx) =>
        tx.employee.findUnique({ where: { id: newEmployeeId } }),
      );
      expect(employee!.passwordHash).not.toBe(memberPassword);
      expect(employee!.passwordHash).toMatch(/^\$argon2id\$/);
    });
  });
});
