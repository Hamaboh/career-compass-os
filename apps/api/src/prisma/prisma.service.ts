import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient, type Prisma } from '@prisma/client';
import type { RequestContext } from '../common/context/request-context';
import { assertOneOf, assertUuid } from '../common/security/sanitize';
import { EMPLOYEE_ROLES } from '@career-compass/shared';

/** RLSコンテキスト未設定時に使う、絶対にマッチしないダミーUUID（unitId=nullのMEMBER/ADMIN等）。 */
const NIL_UUID = '00000000-0000-0000-0000-000000000000';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Phase3 17.2節「セッション変数によるRLSコンテキスト伝播」。
   * `employees`テーブルはRow Level Securityが有効（migrations/*_enable_rls_employees参照）で、
   * `SET LOCAL app.emp_role` 等のセッション変数を見てポリシーが行を絞り込む。
   *
   * 注意（2026-08-14修正）: 当初 `app.current_role` という変数名にしていたが、
   * `CURRENT_ROLE` はPostgreSQLの予約語（CURRENT_USER相当の組込み関数）であり、
   * `SET`文のパラメータ名としてドット修飾しても構文エラー（42601）になることが実機テストで判明した。
   * 予約語と衝突しない `app.emp_role` に変更した（RLSマイグレーションSQLも同時に修正）。
   *
   * PostgresのSET文はバインドパラメータを受け付けないため、値は使用前に必ず
   * assertUuid/assertOneOfでホワイトリスト検証してから文字列として埋め込む。
   *
   * ctxがundefinedの場合（例: ログイン前の招待/OTPフローなど、まだ社員コンテキストが
   * 確立していない内部処理）は、RLSポリシー側が「コンテキストなし=行を返さない」設計になっているため、
   * 呼び出し元がその制約を許容できる場合のみ使う。招待作成等、ADMIN操作の一部はこの経路を使わず、
   * 別途withSystemBypass()（内部用、Serviceからのみ呼び出し可能）を使う。
   */
  async withRlsContext<T>(
    ctx: RequestContext | undefined,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(async (tx) => {
      if (ctx) {
        const role = assertOneOf(ctx.role, EMPLOYEE_ROLES);
        const employeeId = assertUuid(ctx.employeeId);
        const unitId = ctx.unitId ? assertUuid(ctx.unitId) : NIL_UUID;
        await tx.$executeRawUnsafe(`SET LOCAL app.emp_role = '${role}'`);
        await tx.$executeRawUnsafe(`SET LOCAL app.current_employee_id = '${employeeId}'`);
        await tx.$executeRawUnsafe(`SET LOCAL app.current_unit_id = '${unitId}'`);
      } else {
        await tx.$executeRawUnsafe(`SET LOCAL app.emp_role = ''`);
        await tx.$executeRawUnsafe(`SET LOCAL app.current_employee_id = '${NIL_UUID}'`);
        await tx.$executeRawUnsafe(`SET LOCAL app.current_unit_id = '${NIL_UUID}'`);
      }
      return fn(tx);
    });
  }

  /**
   * RLSを迂回してADMIN操作相当の全件アクセスを行うための内部専用メソッド。
   * 招待発行など「まだ本人のセッションが存在しない対象employeeを操作する」処理でのみ使用し、
   * HTTPリクエストのcontroller層から直接呼び出さない（必ずPermissionGuardを通過したService経由）。
   */
  async withSystemBypass<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.emp_role = 'ADMIN'`);
      await tx.$executeRawUnsafe(`SET LOCAL app.current_employee_id = '${NIL_UUID}'`);
      await tx.$executeRawUnsafe(`SET LOCAL app.current_unit_id = '${NIL_UUID}'`);
      return fn(tx);
    });
  }
}
