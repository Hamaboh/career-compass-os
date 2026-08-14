import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { SessionModule } from './session.module';
import { AuditModule } from '../audit/audit.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [SessionModule, AuditModule, MailModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
