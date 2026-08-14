import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * @nestjs/common には 423 Locked / 429 Too Many Requests 用のビルトイン例外クラスが存在しない
 * （BadRequest/Unauthorized/Forbidden/NotFound/Conflict/Gone等の主要なもののみ提供）ため、
 * HttpExceptionを直接継承して用意する（Phase3 16.8/16.9節で明示的に使うステータスコード）。
 */
export class LockedException extends HttpException {
  constructor(response: Record<string, unknown> | string = 'Locked') {
    super(response, HttpStatus.LOCKED);
  }
}

export class TooManyRequestsException extends HttpException {
  constructor(response: Record<string, unknown> | string = 'Too Many Requests') {
    super(response, HttpStatus.TOO_MANY_REQUESTS);
  }
}
