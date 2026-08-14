import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { RequestContextStore, type RequestContext } from '../context/request-context';
import { SessionService } from '../../modules/auth/session.service';
import { ConfigService } from '@nestjs/config';

/**
 * 全リクエストの先頭で走るミドルウェア。セッションCookieがあれば検証し、
 * AsyncLocalStorageにRequestContextを設定してからNestのGuard/Controller/Serviceへ渡す
 * （Phase3 17.2節のRLSコンテキスト伝播と、AuthGuardの認証判定の両方がこの1箇所に依存する）。
 *
 * ここでは「未認証を弾く」判断はしない（それは@Public()を見るAuthGuardの責務）。
 * このミドルウェアはコンテキストを"用意する"だけで、認可判断は行わない。
 */
@Injectable()
export class AuthContextMiddleware implements NestMiddleware {
  constructor(
    private readonly sessionService: SessionService,
    private readonly config: ConfigService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const cookieName = this.config.getOrThrow<string>('SESSION_COOKIE_NAME');
    const rawToken: string | undefined = (req as unknown as { cookies?: Record<string, string> }).cookies?.[
      cookieName
    ];

    const ipAddress = req.ip ?? null;
    let ctx: RequestContext | undefined;

    if (rawToken) {
      const session = await this.sessionService.validateSession(rawToken);
      if (session) {
        ctx = {
          employeeId: session.employeeId,
          role: session.role,
          unitId: session.unitId,
          ipAddress,
        };
        (req as unknown as { employeeContext?: RequestContext }).employeeContext = ctx;
        (req as unknown as { sessionTokenHash?: string }).sessionTokenHash = session.tokenHash;
      }
    }

    RequestContextStore.run(
      ctx ?? { employeeId: '', role: 'EXCLUDED', unitId: null, ipAddress },
      () => next(),
    );
  }
}
