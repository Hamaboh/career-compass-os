import { Module } from '@nestjs/common';
import { AiOrchestrationService } from './ai-orchestration.service';
import { AiCallLogService } from './ai-call-log.service';
import { anthropicClientProvider } from './claude-client.provider';

/**
 * Phase3 14章。他モジュール（自己分析/夢/Why/目標階層/目標候補）はこのモジュールをimportし、
 * AiOrchestrationServiceのみをDI注入して使う。Anthropic SDKを直接importしないこと。
 */
@Module({
  providers: [anthropicClientProvider, AiOrchestrationService, AiCallLogService],
  exports: [AiOrchestrationService],
})
export class AiOrchestrationModule {}
