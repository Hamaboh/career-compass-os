import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

/**
 * ルートモジュール。Step 0以降、ここに以下を順次登録していく（docs/DESIGN_FREEZE.md参照）:
 *   - AuthModule（招待/OTP/パスワード/セッション、Phase3 8〜12章）
 *   - グローバル AuthGuard / PermissionGuard / ScopeGuard（Phase3 7.4章）
 *   - Domain API Modules（目標階層・SMART・制度接続・1on1等、Phase3 5章のドメイン単位）
 *   - AiOrchestrationModule（Phase3 14章、唯一のAI呼び出し経路）
 *   - PrismaModule
 */
@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
