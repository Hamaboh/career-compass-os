import { Module } from '@nestjs/common';
import { DreamService } from './dream.service';
import { DreamController, VisionsController } from './dream.controller';
import { AiOrchestrationModule } from '../../ai-orchestration/ai-orchestration.module';

@Module({
  imports: [AiOrchestrationModule],
  controllers: [DreamController, VisionsController],
  providers: [DreamService],
  exports: [DreamService],
})
export class DreamModule {}
