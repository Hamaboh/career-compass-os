import { ContextAssembler } from './context-assembler';

/**
 * <ai_principles>「AIの推測とユーザーの明示的回答をデータ上分離する」の入力側実装の単体テスト。
 * 未承認のai_inferredフィールドが後続のAI呼び出しのプロンプトに混入しないことを保証する。
 */
describe('ContextAssembler', () => {
  it('user_statedのフィールドは常に含める', () => {
    const result = ContextAssembler.assembleConfirmedFields({
      dream: { value: '自分でエンジニアリング組織を作りたい', source: 'user_stated', userApproved: false },
    });
    expect(result).toEqual({ dream: '自分でエンジニアリング組織を作りたい' });
  });

  it('ai_inferredかつuserApproved=trueのフィールドは含める', () => {
    const result = ContextAssembler.assembleConfirmedFields({
      strength: { value: '傾聴力が高い', source: 'ai_inferred', userApproved: true },
    });
    expect(result).toEqual({ strength: '傾聴力が高い' });
  });

  it('ai_inferredかつuserApproved=falseのフィールドは除外する（未承認のAI推測を後続に渡さない）', () => {
    const result = ContextAssembler.assembleConfirmedFields({
      unapprovedGuess: { value: '本当はマネジメント志向のはず', source: 'ai_inferred', userApproved: false },
    });
    expect(result).toEqual({});
    expect(result).not.toHaveProperty('unapprovedGuess');
  });

  it('承認済み・未承認が混在する場合は承認済みのみ残す', () => {
    const result = ContextAssembler.assembleConfirmedFields({
      approved: { value: 'A', source: 'ai_inferred', userApproved: true },
      unapproved: { value: 'B', source: 'ai_inferred', userApproved: false },
      stated: { value: 'C', source: 'user_stated', userApproved: false },
    });
    expect(result).toEqual({ approved: 'A', stated: 'C' });
  });
});
