import { Module } from '@nestjs/common';
import { InvitationsService } from './invitations.service';
import { InvitationsController } from './invitations.controller';
import { AuditModule } from '../audit/audit.module';
import { MailModule } from '../mail/mail.module';
import { SessionModule } from '../auth/session.module';

@Module({
  imports: [AuditModule, MailModule, SessionModule],
  controllers: [InvitationsController],
  providers: [InvitationsService],
})
export class InvitationsModule {}
