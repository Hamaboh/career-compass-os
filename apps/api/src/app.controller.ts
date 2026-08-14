import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * ヘルスチェック専用エンドポイント。認可の対象外（16.10節の`@Public()`除外セットに相当、
   * 実際のデコレータはStep 0で導入する）。Docker Composeのスタック疎通確認に使う。
   */
  @Get('healthz')
  healthz() {
    return this.appService.getHealth();
  }
}
