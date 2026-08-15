import {
  AiResponseValidationError,
  assertArray,
  assertBoolean,
  assertEnum,
  assertNumberInRange,
  assertOptionalString,
  assertRecord,
  assertString,
  assertStringArray,
} from './response-validator';

/**
 * Phase3 14章 ResponseValidator。AIの出力を無検証で信頼しない、という境界の単体テスト。
 * <ai_principles>「AIの推測とユーザーの明示的回答をデータ上分離する」を支える最終防衛ライン。
 */
describe('response-validator', () => {
  describe('assertRecord', () => {
    it('オブジェクトを受理する', () => {
      expect(assertRecord({ a: 1 }, 'root')).toEqual({ a: 1 });
    });
    it('配列やnullは拒否する', () => {
      expect(() => assertRecord([], 'root')).toThrow(AiResponseValidationError);
      expect(() => assertRecord(null, 'root')).toThrow(AiResponseValidationError);
      expect(() => assertRecord('text', 'root')).toThrow(AiResponseValidationError);
    });
  });

  describe('assertString', () => {
    it('空文字列はデフォルトで拒否する', () => {
      expect(() => assertString('', 'field')).toThrow(AiResponseValidationError);
    });
    it('allowEmpty指定時は空文字列を許容する', () => {
      expect(assertString('', 'field', { allowEmpty: true })).toBe('');
    });
    it('数値等の非文字列は拒否する', () => {
      expect(() => assertString(123, 'field')).toThrow(AiResponseValidationError);
    });
  });

  describe('assertOptionalString', () => {
    it('undefined/nullはundefinedを返す', () => {
      expect(assertOptionalString(undefined, 'f')).toBeUndefined();
      expect(assertOptionalString(null, 'f')).toBeUndefined();
    });
    it('値がある場合は検証する', () => {
      expect(assertOptionalString('x', 'f')).toBe('x');
      expect(() => assertOptionalString(42, 'f')).toThrow(AiResponseValidationError);
    });
  });

  describe('assertBoolean', () => {
    it('真偽値以外は拒否する', () => {
      expect(assertBoolean(true, 'f')).toBe(true);
      expect(() => assertBoolean('true', 'f')).toThrow(AiResponseValidationError);
    });
  });

  describe('assertNumberInRange', () => {
    it('範囲内の数値を受理する', () => {
      expect(assertNumberInRange(50, 'score', 0, 100)).toBe(50);
    });
    it('範囲外の数値は拒否する（AIが0-100の指示を無視した場合の防御）', () => {
      expect(() => assertNumberInRange(150, 'score', 0, 100)).toThrow(AiResponseValidationError);
      expect(() => assertNumberInRange(-1, 'score', 0, 100)).toThrow(AiResponseValidationError);
    });
    it('NaNは拒否する', () => {
      expect(() => assertNumberInRange(Number.NaN, 'score', 0, 100)).toThrow(AiResponseValidationError);
    });
  });

  describe('assertEnum', () => {
    it('許可された値のみ受理する', () => {
      expect(assertEnum('strength', 'insightType', ['strength', 'weakness'] as const)).toBe('strength');
      expect(() => assertEnum('unknown_type', 'insightType', ['strength', 'weakness'] as const)).toThrow(
        AiResponseValidationError,
      );
    });
  });

  describe('assertStringArray', () => {
    it('文字列配列を受理し、maxItemsを超えたものは拒否する', () => {
      expect(assertStringArray(['a', 'b'], 'tags')).toEqual(['a', 'b']);
      expect(() => assertStringArray(['a', 'b', 'c'], 'tags', { maxItems: 2 })).toThrow(AiResponseValidationError);
    });
    it('文字列以外を含む配列は拒否する', () => {
      expect(() => assertStringArray(['a', 1], 'tags')).toThrow(AiResponseValidationError);
    });
  });

  describe('assertArray', () => {
    it('minItems/maxItemsを検証する（夢仮説2〜3件等の制約に対応）', () => {
      const validator = (v: unknown) => assertString(v, 'item');
      expect(() => assertArray([], 'hypotheses', validator, { minItems: 1 })).toThrow(AiResponseValidationError);
      expect(() => assertArray(['a', 'b', 'c', 'd'], 'hypotheses', validator, { maxItems: 3 })).toThrow(
        AiResponseValidationError,
      );
      expect(assertArray(['a', 'b'], 'hypotheses', validator, { minItems: 1, maxItems: 3 })).toEqual(['a', 'b']);
    });
  });
});
