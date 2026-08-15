import { Module } from '@nestjs/common';
import { SelfAnalysisService } from './self-analysis.service';
import { SelfAnalysisController } from './self-analysis.controller';
import { AiOrchestrationModule } from '../../ai-orchestration/ai-orchestration.module';

@Module({
  imports: [AiOrchestrationModule],
  controllers: [SelfAnalysisController],
  providers: [SelfAnalysisService],
  exports: [SelfAnalysisService],
})
export class SelfAnalysisModule {}
