import { Injectable, CanActivate, type ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Phase3 16.3節 CSRF対策・第二防御線（Double Submit Cookie）。
 * SameSite=Strict（第一防御線）は既にセッションCookie自体で効いているので、本Guardは
 * 「同一オリジン内の悪意あるスクリプト」シナリオに備えた多層防御として、状態変更を伴う
 * 全リクエスト（POST/PATCH/PUT/DELETE）にX-CSRF-Tokenヘッダとcsrf_token Cookieの一致を要求する。
 *
 * @Public() ルート（ログイン・招待/OTP/パスワードリセット等、セッションCookieに依存しないトークン
 * ベースのフロー）はCSRFトークンがまだ発行されていないため対象外とする（Phase4設計での整理どおり、
 * 古典的CSRFは「アンビエントなセッションCookieの悪用」が前提であり、これらのフローには該当しない）。
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(request.method)) return true;

    const cookieName = this.config.getOrThrow<string>('CSRF_COOKIE_NAME');
    const cookieValue = (request as unknown as { cookies?: Record<string, string> }).cookies?.[cookieName];
    const headerValue = request.header('X-CSRF-Token');

    if (!cookieValue || !headerValue || cookieValue !== headerValue) {
      throw new ForbiddenException({
        error: { code: 'FORBIDDEN', message: 'CSRFトークンが一致しません' },
      });
    }
    return true;
  }
}
