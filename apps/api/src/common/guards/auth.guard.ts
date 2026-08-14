import { Injectable, CanActivate, type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { RequestContext } from '../context/request-context';

/**
 * Phase3 7.4節 手順1「認証チェック」。AuthContextMiddlewareが既にセッション検証済みで
 * request.employeeContext を設定しているかどうかだけを見る（Redis参照はミドルウェア側で1回のみ行う）。
 * @Public() が付いたルートは常に通す（16.10節「除外対象は最小セットに限定」）。
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context
      .switchToHttp()
      .getRequest<{ employeeContext?: RequestContext }>();

    if (!request.employeeContext || !request.employeeContext.employeeId) {
      throw new UnauthorizedException({
        error: {
          code: 'UNAUTHORIZED',
          message: 'ログインが必要です',
        },
      });
    }
    return true;
  }
}
