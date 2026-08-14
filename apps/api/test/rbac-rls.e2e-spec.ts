import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootstrapTestApp } from './utils/bootstrap-test-app';
import { PrismaService } from '../src/prisma/prisma.service';
import { hashPassword } from '../src/common/security/password-hash';

/**
 * Phase3 17章「Unit単位のアクセス制御」をRLSポリシー込みで実際のHTTP経由で検証する。
 * ADMIN/UL/MEMBERそれぞれの可視範囲が employees_admin_all / employees_ul_select_unit_scope /
 * employees_self_select ポリシーどおりになっていることを確認する。
 */
describe('RBAC / Row Level Security (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const password = 'TestPass123!';
  const suffix = Date.now();

  const ids: Record<string, string> = {};

  async function seedEmployee(
    key: string,
    role: 'ADMIN' | 'UL' | 'MEMBER',
    unitId: string | undefined,
  ) {
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
    return employee;
  }

  async function login(key: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: `${key}-${suffix}@example.com`, password })
      .expect(200);
    return res.get('Set-Cookie')!.find((c) => c.startsWith('__Host-session='))!.split(';')[0];
  }

  beforeAll(async () => {
    app = await bootstrapTestApp();
    prisma = app.get(PrismaService);

    const unitA = await prisma.unit.create({ data: { name: `UnitA-${suffix}` } });
    const unitB = await prisma.unit.create({ data: { name: `UnitB-${suffix}` } });
    ids.unitA = unitA.id;
    ids.unitB = unitB.id;

    await seedEmployee('admin', 'ADMIN', undefined);
    await seedEmployee('ulA', 'UL', unitA.id);
    await seedEmployee('memberA1', 'MEMBER', unitA.id);
    await seedEmployee('memberA2', 'MEMBER', unitA.id);
    await seedEmployee('memberB1', 'MEMBER', unitB.id);
  });

  afterAll(async () => {
    await app.close();
  });

  it('ADMIN sees every employee', async () => {
    const cookie = await login('admin');
    const res = await request(app.getHttpServer())
      .get('/v1/employees')
      .set('Cookie', cookie)
      .expect(200);
    const seenIds = res.body.map((e: { id: string }) => e.id);
    expect(seenIds).toEqual(
      expect.arrayContaining([ids.admin, ids.ulA, ids.memberA1, ids.memberA2, ids.memberB1]),
    );
  });

  it('UL sees only own-Unit members plus self, not other Units', async () => {
    const cookie = await login('ulA');
    const res = await request(app.getHttpServer())
      .get('/v1/employees')
      .set('Cookie', cookie)
      .expect(200);
    const seenIds = res.body.map((e: { id: string }) => e.id).sort();
    expect(seenIds).toEqual([ids.memberA1, ids.memberA2, ids.ulA].sort());
    expect(seenIds).not.toContain(ids.memberB1);
    expect(seenIds).not.toContain(ids.admin);
  });

  it('MEMBER sees only self', async () => {
    const cookie = await login('memberA1');
    const res = await request(app.getHttpServer())
      .get('/v1/employees')
      .set('Cookie', cookie)
      .expect(200);
    const seenIds = res.body.map((e: { id: string }) => e.id);
    expect(seenIds).toEqual([ids.memberA1]);
  });

  it('MEMBER GET /employees/me returns their own record', async () => {
    const cookie = await login('memberA2');
    const res = await request(app.getHttpServer())
      .get('/v1/employees/me')
      .set('Cookie', cookie)
      .expect(200);
    expect(res.body.id).toBe(ids.memberA2);
  });

  it('never exposes passwordHash via the HTTP API, in any employees response (Phase3 16.10節)', async () => {
    const adminCookie = await login('admin');
    const meRes = await request(app.getHttpServer())
      .get('/v1/employees/me')
      .set('Cookie', adminCookie)
      .expect(200);
    expect(meRes.body).not.toHaveProperty('passwordHash');

    const listRes = await request(app.getHttpServer())
      .get('/v1/employees')
      .set('Cookie', adminCookie)
      .expect(200);
    for (const e of listRes.body) {
      expect(e).not.toHaveProperty('passwordHash');
    }
  });

  it("MEMBER fetching another employee's id gets 404, not 403 (existence not leaked)", async () => {
    const cookie = await login('memberA1');
    await request(app.getHttpServer())
      .get(`/v1/employees/${ids.memberB1}`)
      .set('Cookie', cookie)
      .expect(404);
  });

  it('MEMBER cannot create employees even by calling the API directly (PermissionsGuard)', async () => {
    const cookie = await login('memberA1');
    await request(app.getHttpServer())
      .post('/v1/employees')
      .set('Cookie', cookie)
      // CSRFトークンなしでも先に403(FORBIDDEN)で権限エラーになることを期待（Guard評価順: Auth→Permission→CSRF）
      .send({ email: `sneaky-${suffix}@example.com`, name: 'x', role: 'MEMBER' })
      .expect(403);
  });
});
