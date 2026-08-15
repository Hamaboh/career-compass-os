import { Inject, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_CLIENT } from './claude-client.provider';
import { AiCallLogService } from './ai-call-log.service';
import { PROMPT_TEMPLATES } from './prompt-templates';

export interface CallAgentInput {
  templateId: string;
  /** システムユーザー起因(バッチ等)の場合はnull。監査ログ用途。 */
  employeeId: string | null;
  context: Record<string, unknown>;
}

export interface CallAgentResult<T> {
  data: T;
}

/**
 * Phase3 14章「AI Orchestration Service」— アプリ内でAnthropic APIを呼び出す唯一の経路。
 * 各ドメインService（自己分析/夢/Why/目標候補生成）はこのServiceのcallAgent()のみを通じて
 * AIを呼び出し、Anthropic SDKを直接importしない（14.1節の絶対原則をコード構造で強制する）。
 *
 * テスト時はこのService自体をDI差し替えする（test/utils/mock-ai-orchestration.service.ts、
 * MailService→MockMailServiceと同じパターン）ことで、実際のAPI呼び出しを避ける。
 */
@Injectable()
export class AiOrchestrationService {
  private readonly logger = new Logger(AiOrchestrationService.name);

  constructor(
    @Inject(ANTHROPIC_CLIENT) private readonly client: Anthropic,
    private readonly config: ConfigService,
    private readonly aiCallLog: AiCallLogService,
  ) {}

  async callAgent<T>(input: CallAgentInput): Promise<CallAgentResult<T>> {
    const template = PROMPT_TEMPLATES[input.templateId];
    if (!template) {
      throw new InternalServerErrorException(`未登録のprompt templateです: ${input.templateId}`);
    }

    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey || apiKey.trim().length === 0) {
      throw new InternalServerErrorException('ANTHROPIC_API_KEYが未設定のため、AI機能を利用できません');
    }

    const model = this.config.get<string>('ANTHROPIC_MODEL') ?? 'claude-sonnet-5';
    const userMessage = template.buildUserMessage(input.context);

    let success = false;
    let errorMessage: string | undefined;
    try {
      const response = await this.client.messages.create({
        model,
        max_tokens: template.maxTokens,
        thinking: { type: 'adaptive' },
        system: template.systemPrompt,
        output_config: {
          format: { type: 'json_schema', schema: template.responseSchema },
        },
        messages: [{ role: 'user', content: userMessage }],
      });

      if (response.stop_reason === 'refusal') {
        throw new InternalServerErrorException('AIが応答を拒否しました（安全性フィルタ）');
      }

      const textBlock = response.content.find(
        (block): block is Anthropic.Messages.TextBlock => block.type === 'text',
      );
      if (!textBlock) {
        throw new InternalServerErrorException('AI応答にテキストブロックが含まれていません');
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(textBlock.text) as unknown;
      } catch {
        throw new InternalServerErrorException('AI応答のJSON解析に失敗しました');
      }

      const validated = template.validate(parsed) as T;
      success = true;
      return { data: validated };
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.error(`AI呼び出しに失敗しました (template=${input.templateId})`, errorMessage);
      throw err;
    } finally {
      await this.aiCallLog.record({
        employeeId: input.employeeId,
        agentName: template.agentName,
        promptTemplateId: template.id,
        model,
        success,
        errorMessage,
      });
    }
  }
}
