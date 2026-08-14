import { AsyncLocalStorage } from 'node:async_hooks';
import type { EmployeeRole } from '@career-compass/shared';

/**
 * リクエスト単位のコンテキスト。AuthContextMiddleware（common/middleware/auth-context.middleware.ts）が
 * セッションCookieを検証した直後に設定し、Guard・Service・PrismaService.withRlsContext まで
 * 一貫して同じ値を参照できるようにする（Phase3 17.2節「セッション変数によるRLSコンテキスト伝播」）。
 *
 * Express Middleware → Guard → Controller → Service という非同期の呼び出し連鎖をまたいで
 * 値を引き回すためにNode標準のAsyncLocalStorageを使う（追加ライブラリに依存しない）。
 */
export interface RequestContext {
  employeeId: string;
  role: EmployeeRole;
  unitId: string | null;
  /** レート制限・監査ログ用。Caddyがtrust proxy経由で渡すクライアントIP。 */
  ipAddress: string | null;
}

const storage = new AsyncLocalStorage<RequestContext>();

export const RequestContextStore = {
  run<T>(ctx: RequestContext, fn: () => T): T {
    return storage.run(ctx, fn);
  },
  get(): RequestContext | undefined {
    return storage.getStore();
  },
};
