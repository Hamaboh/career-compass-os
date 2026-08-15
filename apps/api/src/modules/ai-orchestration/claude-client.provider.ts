import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

export const ANTHROPIC_CLIENT = Symbol('ANTHROPIC_CLIENT');

/**
 * Phase3 14.1節「AI Orchestration Serviceが唯一のAI呼び出し経路」。
 * ANTHROPIC_API_KEY未設定でもプロバイダ自体は生成する（MailServiceのSMTP_HOST未設定時と同じ考え方で、
 * AI機能を使わない他の全機能の起動をブロックしないため）。実際にAIを呼び出す時点で
 * AiOrchestrationServiceがキー未設定を検知して例外を投げる。
 */
export const anthropicClientProvider = {
  provide: ANTHROPIC_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService): Anthropic => {
    const apiKey = config.get<string>('ANTHROPIC_API_KEY');
    return new Anthropic({ apiKey: apiKey && apiKey.trim().length > 0 ? apiKey : 'not-configured' });
  },
};
