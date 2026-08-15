import { Module } from '@nestjs/common';
import { InstitutionalService } from './institutional.service';
import {
  KpiMasterController,
  UlmMasterController,
  InstitutionalConnectionsController,
  EvaluationPeriodsController,
  CompetencyMasterController,
  PositionMasterController,
} from './institutional.controller';
import { AuditModule } from '../audit/audit.module';
import { WhyModule } from '../self-understanding/why/why.module';

@Module({
  imports: [AuditModule, WhyModule],
  controllers: [
    KpiMasterController,
    UlmMasterController,
    InstitutionalConnectionsController,
    EvaluationPeriodsController,
    CompetencyMasterController,
    PositionMasterController,
  ],
  providers: [InstitutionalService],
  exports: [InstitutionalService],
})
export class InstitutionalModule {}
