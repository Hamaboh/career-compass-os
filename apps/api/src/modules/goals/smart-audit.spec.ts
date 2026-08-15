import { isSmartAuditPassing } from '@career-compass/shared';

/**
 * <smart_gate>要件。「SMART監査を通過、または本人が合理的な理由を承認した場合のみ確定可能」の
 * うち、「通過」判定そのものの単体テスト（GoalsService.confirmLongTermGoal()が使用する）。
 * packages/sharedにはテストランナーが導入されていないため（design freezeルール4:
 * 既存の技術スタックの範囲で実装する）、既にJestが構成済みのapps/api側でこの共有関数を検証する。
 */
describe('isSmartAuditPassing (via @career-compass/shared)', () => {
  it('5項目すべてokならtrue', () => {
    expect(
      isSmartAuditPassing({
        specific: 'ok',
        measurable: 'ok',
        achievable: 'ok',
        relevant: 'ok',
        timebound: 'ok',
      }),
    ).toBe(true);
  });

  it('1項目でもneeds_improvementがあればfalse', () => {
    expect(
      isSmartAuditPassing({
        specific: 'ok',
        measurable: 'needs_improvement',
        achievable: 'ok',
        relevant: 'ok',
        timebound: 'ok',
      }),
    ).toBe(false);
  });

  it('1項目でもinsufficientがあればfalse', () => {
    expect(
      isSmartAuditPassing({
        specific: 'ok',
        measurable: 'ok',
        achievable: 'ok',
        relevant: 'ok',
        timebound: 'insufficient',
      }),
    ).toBe(false);
  });

  it('未監査（undefined）の項目があればfalse（監査を必ず実行させる）', () => {
    expect(
      isSmartAuditPassing({
        specific: 'ok',
        measurable: 'ok',
        achievable: 'ok',
        relevant: 'ok',
      }),
    ).toBe(false);
  });

  it('空オブジェクトはfalse', () => {
    expect(isSmartAuditPassing({})).toBe(false);
  });
});
