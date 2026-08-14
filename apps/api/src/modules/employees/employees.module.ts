import { Module } from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { EmployeesController } from './employees.controller';
import { AuditModule } from '../audit/audit.module';
import { SessionModule } from '../auth/session.module';

@Module({
  imports: [AuditModule, SessionModule],
  controllers: [EmployeesController],
  providers: [EmployeesService],
  exports: [EmployeesService],
})
export class EmployeesModule {}
