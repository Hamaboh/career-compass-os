import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './common/decorators/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * ヘルスチェック専用エンドポイント。認可の対象外（Phase3 16.10節の`@Public()`除外セット、
   * `/healthz`, `/invitations/*`, `/auth/login`等の最小セットに限定）。
   * Docker Composeのスタック疎通確認に使う。
   */
  @Get('healthz')
  @Public()
  healthz() {
    return this.appService.getHealth();
  }
}
