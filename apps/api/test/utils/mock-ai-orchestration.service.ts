import { Injectable } from '@nestjs/common';
import type { CallAgentInput, CallAgentResult } from '../../src/modules/ai-orchestration/ai-orchestration.service';

/**
 * AiOrchestrationServiceの実API呼び出しを行わないテスト用差し替え。MockMailServiceと同じ方針。
 * テストごとにresponses.setで期待するテンプレートIDに対する戻り値を登録できる。
 * 未登録のテンプレートIDが呼ばれた場合は、呼び出しがあったこと自体を記録したうえで
 * 汎用的な最小限のダミー値を返す（テストが個々のAI応答内容に依存しすぎないようにする）。
 */
@Injectable()
export class MockAiOrchestrationService {
  public readonly calls: CallAgentInput[] = [];
  private readonly responses = new Map<string, unknown>();

  setResponse(templateId: string, data: unknown): void {
    this.responses.set(templateId, data);
  }

  async callAgent<T>(input: CallAgentInput): Promise<CallAgentResult<T>> {
    this.calls.push(input);
    if (this.responses.has(input.templateId)) {
      return { data: this.responses.get(input.templateId) as T };
    }
    return { data: {} as T };
  }
}
