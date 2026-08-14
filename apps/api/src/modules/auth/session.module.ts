import { Module } from '@nestjs/common';
import { SessionService } from './session.service';

/**
 * SessionServiceを独立モジュールに切り出す理由: AuthModule(ログイン等)とEmployeesModule
 * (アカウント状態変更時の全セッション失効)の双方が必要とするため、AuthModule⇄EmployeesModuleの
 * 循環importを避けてSessionModuleを共通の依存先にする。
 */
@Module({
  providers: [SessionService],
  exports: [SessionService],
})
export class SessionModule {}
