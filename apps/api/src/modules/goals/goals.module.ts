import { Module } from '@nestjs/common';
import { GoalsService } from './goals.service';
import { DirectionsController } from './directions.controller';
import { LongTermGoalsController } from './long-term-goals.controller';
import { CheckpointsController } from './checkpoints.controller';
import { GoalCandidatesController } from './goal-candidates.controller';
import { AiOrchestrationModule } from '../ai-orchestration/ai-orchestration.module';
import { WhyModule } from '../self-understanding/why/why.module';
import { RemindersModule } from '../reminders/reminders.module';

@Module({
  imports: [AiOrchestrationModule, WhyModule, RemindersModule],
  controllers: [DirectionsController, LongTermGoalsController, CheckpointsController, GoalCandidatesController],
  providers: [GoalsService],
  exports: [GoalsService],
})
export class GoalsModule {}
