import { MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { validateEnv } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { SecurityModule } from './common/security/security.module';
import { AuthModule } from './modules/auth/auth.module';
import { SessionModule } from './modules/auth/session.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { UnitsModule } from './modules/units/units.module';
import { InvitationsModule } from './modules/invitations/invitations.module';
import { AuditModule } from './modules/audit/audit.module';
import { MailModule } from './modules/mail/mail.module';
import { AiOrchestrationModule } from './modules/ai-orchestration/ai-orchestration.module';
import { SelfAnalysisModule } from './modules/self-understanding/self-analysis/self-analysis.module';
import { DreamModule } from './modules/self-understanding/dream/dream.module';
import { WhyModule } from './modules/self-understanding/why/why.module';
import { GoalsModule } from './modules/goals/goals.module';
import { InstitutionalModule } from './modules/institutional/institutional.module';
import { RemindersModule } from './modules/reminders/reminders.module';
import { GoalContinuityModule } from './modules/goal-continuity/goal-continuity.module';
import { OneOnOneModule } from './modules/one-on-one/one-on-one.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AppSettingsModule } from './modules/app-settings/app-settings.module';
import { AuthGuard } from './common/guards/auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { CsrfGuard } from './common/guards/csrf.guard';
import { AuthContextMiddleware } from './common/middleware/auth-context.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    PrismaModule,
    RedisModule,
    SecurityModule,
    SessionModule,
    MailModule,
    AuditModule,
    AuthModule,
    EmployeesModule,
    UnitsModule,
    InvitationsModule,
    // 自己分析〜目標形成ドメイン（このStepで追加）
    AiOrchestrationModule,
    SelfAnalysisModule,
    DreamModule,
    WhyModule,
    GoalsModule,
    InstitutionalModule,
    // 目標確定後の継続支援ドメイン（このStepで追加: SMART/行動/進捗/振り返り/1on1/リマインド）
    RemindersModule,
    GoalContinuityModule,
    OneOnOneModule,
    // MVP完成フェーズ（ADMIN/UL/MEMBER全機能+通知、Phase4 17章MVP機能一覧準拠）で追加
    NotificationsModule,
    AppSettingsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Phase3 7.4節の3段階チェックをグローバルGuardとして登録する順序どおりに並べる:
    // 1. 認証(AuthGuard) → 2. 権限(PermissionsGuard)。ScopeGuard相当はRLS(PrismaService)+
    // Service層のフィルタ条件で担保する（設計判断はdocs/DESIGN_FREEZE.md参照）。
    // CSRFは状態変更リクエストに対する追加防御としてAuthGuardの後に評価する。
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthContextMiddleware).forRoutes('*');
  }
}
