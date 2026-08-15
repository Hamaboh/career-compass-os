import { AI_INDICATOR_DISCLAIMER, scoreToLabel, toQualitativeIndicator } from './score-label';

/**
 * Phase2 FOUNDATION §0.4「心理指標の共通表示ルール」。生スコアを外部に出さず、
 * 5段階の質的ラベル＋注記に変換して公開する、という境界の単体テスト。
 */
describe('score-label', () => {
  describe('scoreToLabel', () => {
    it.each([
      [0, 'very_low'],
      [19, 'very_low'],
      [20, 'low'],
      [39, 'low'],
      [40, 'medium'],
      [59, 'medium'],
      [60, 'high'],
      [79, 'high'],
      [80, 'very_high'],
      [100, 'very_high'],
    ])('score=%i -> %s', (score, expected) => {
      expect(scoreToLabel(score)).toBe(expected);
    });
  });

  describe('toQualitativeIndicator', () => {
    it('null/undefinedはnullを返す（AI分析が未実施の場合）', () => {
      expect(toQualitativeIndicator(null)).toBeNull();
      expect(toQualitativeIndicator(undefined)).toBeNull();
    });

    it('スコアがある場合はラベルと注記を返し、生スコアは含まない', () => {
      const indicator = toQualitativeIndicator(75);
      expect(indicator).toEqual({ label: 'high', note: AI_INDICATOR_DISCLAIMER });
      expect(indicator).not.toHaveProperty('score');
      expect(JSON.stringify(indicator)).not.toContain('75');
    });
  });
});
