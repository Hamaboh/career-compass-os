import { Injectable, CanActivate, type ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { hasPermission, type PermissionFlag } from '@career-compass/shared';
import { REQUIRE_PERMISSION_KEY } from '../decorators/require-permission.decorator';
import type { RequestContext } from '../context/request-context';

/**
 * Phase3 7.4節 手順2「権限チェック」。@RequirePermission(...)が宣言されていないルートは
 * 素通り（=SELF_DATA系など、権限フラグではなくスコープのみで守られるエンドポイント）。
 * 権限判定そのものは packages/shared の hasPermission() を唯一の関所として使う
 * （design freezeルール4: 判定ロジックをここに再実装しない）。
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<PermissionFlag[]>(REQUIRE_PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<{ employeeContext?: RequestContext }>();
    const role = request.employeeContext?.role;
    if (!role) {
      throw new ForbiddenException({ error: { code: 'FORBIDDEN', message: 'この操作を行う権限がありません' } });
    }

    const ok = required.every((flag) => hasPermission(role, flag));
    if (!ok) {
      throw new ForbiddenException({ error: { code: 'FORBIDDEN', message: 'この操作を行う権限がありません' } });
    }
    return true;
  }
}
