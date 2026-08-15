import { Module } from '@nestjs/common';
import { GoalContinuityService } from './goal-continuity.service';
import { ActionsController } from './actions.controller';
import { ProgressController } from './progress.controller';
import { ReflectionsController } from './reflections.controller';
import { GoalAiInsightsController } from './goal-ai-insights.controller';
import { AiOrchestrationModule } from '../ai-orchestration/ai-orchestration.module';

@Module({
  imports: [AiOrchestrationModule],
  controllers: [ActionsController, ProgressController, ReflectionsController, GoalAiInsightsController],
  providers: [GoalContinuityService],
  exports: [GoalContinuityService],
})
export class GoalContinuityModule {}
