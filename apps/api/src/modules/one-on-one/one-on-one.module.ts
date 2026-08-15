import { Module } from '@nestjs/common';
import { OneOnOneService } from './one-on-one.service';
import { OneOnOneController } from './one-on-one.controller';
import { AiOrchestrationModule } from '../ai-orchestration/ai-orchestration.module';

@Module({
  imports: [AiOrchestrationModule],
  controllers: [OneOnOneController],
  providers: [OneOnOneService],
  exports: [OneOnOneService],
})
export class OneOnOneModule {}
