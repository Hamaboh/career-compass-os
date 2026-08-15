import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface RecordAiCallLogInput {
  employeeId: string | null;
  agentName: string;
  promptTemplateId: string;
  model: string;
  success: boolean;
  errorMessage?: string;
}

/**
 * Phase3 14.5節。AI呼び出し自体の技術的実行ログ（audit_logsとは別テーブル、ADMIN限定）。
 * ai_call_logsはRLSでADMINのみに制限されているため、呼び出し元employeeの権限に関わらず
 * withSystemBypass()で書き込む（監査ログの一種であり、書き込み自体は本人の権限に依存しない
 * システム内部処理として扱う）。
 */
@Injectable()
export class AiCallLogService {
  private readonly logger = new Logger(AiCallLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordAiCallLogInput): Promise<void> {
    try {
      await this.prisma.withSystemBypass((tx) =>
        tx.aiCallLog.create({
          data: {
            employeeId: input.employeeId,
            agentName: input.agentName,
            promptTemplateId: input.promptTemplateId,
            model: input.model,
            success: input.success,
            errorMessage: input.errorMessage,
          },
        }),
      );
    } catch (err) {
      // ai_call_logsへの書き込み失敗自体はAI呼び出し結果に影響させない（監査ログの二次的失敗で
      // 本来の業務処理を止めない、audit_logsと同じ考え方）。ログにだけ残す。
      this.logger.error('ai_call_logsへの書き込みに失敗しました', err instanceof Error ? err.stack : String(err));
    }
  }
}
