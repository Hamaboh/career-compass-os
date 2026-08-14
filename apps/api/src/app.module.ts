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
