import { Module } from '@nestjs/common';
import { WhyService } from './why.service';
import { WhyController } from './why.controller';
import { AiOrchestrationModule } from '../../ai-orchestration/ai-orchestration.module';

@Module({
  imports: [AiOrchestrationModule],
  controllers: [WhyController],
  providers: [WhyService],
  exports: [WhyService],
})
export class WhyModule {}
