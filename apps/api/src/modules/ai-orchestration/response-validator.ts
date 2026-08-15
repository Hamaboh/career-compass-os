/**
 * Phase3 14章 ResponseValidator。
 *
 * output_config.format（構造化出力）はJSONの「形」を保証するが、値の意味的な妥当性
 * （文字列が空でないか、スコアが範囲内か等）までは保証しない。JSON Schema自体も
 * 数値・文字列の範囲制約（minimum/maximum/minLength等）に非対応のため、ここでAIの
 * レスポンスを最終的に検証してから呼び出し元に返す。
 * common/security/sanitize.ts の assertUuid/assertOneOf と同じ「検証してから使う」規約を、
 * AIレスポンスの境界にも適用したもの。
 */

export class AiResponseValidationError extends Error {
  constructor(field: string, reason: string) {
    super(`AIレスポンスの検証に失敗しました: ${field} — ${reason}`);
    this.name = 'AiResponseValidationError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function assertRecord(value: unknown, field: string): Record<string, unknown> {
  if (!isRecord(value)) throw new AiResponseValidationError(field, 'オブジェクトではありません');
  return value;
}

export function assertString(value: unknown, field: string, opts: { allowEmpty?: boolean } = {}): string {
  if (typeof value !== 'string') throw new AiResponseValidationError(field, '文字列ではありません');
  if (!opts.allowEmpty && value.trim().length === 0) {
    throw new AiResponseValidationError(field, '空文字列です');
  }
  return value;
}

export function assertOptionalString(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  return assertString(value, field, { allowEmpty: false });
}

export function assertBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') throw new AiResponseValidationError(field, '真偽値ではありません');
  return value;
}

export function assertNumberInRange(value: unknown, field: string, min: number, max: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new AiResponseValidationError(field, '数値ではありません');
  }
  if (value < min || value > max) {
    throw new AiResponseValidationError(field, `${min}〜${max}の範囲外です（実際: ${value}）`);
  }
  return value;
}

export function assertEnum<T extends string>(value: unknown, field: string, allowed: readonly T[]): T {
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
    throw new AiResponseValidationError(field, `許可された値ではありません（許可: ${allowed.join(', ')}）`);
  }
  return value as T;
}

export function assertStringArray(value: unknown, field: string, opts: { maxItems?: number } = {}): string[] {
  if (!Array.isArray(value) || !value.every((v) => typeof v === 'string')) {
    throw new AiResponseValidationError(field, '文字列の配列ではありません');
  }
  if (opts.maxItems && value.length > opts.maxItems) {
    throw new AiResponseValidationError(field, `最大${opts.maxItems}件までです（実際: ${value.length}件）`);
  }
  return value as string[];
}

export function assertArray<T>(
  value: unknown,
  field: string,
  itemValidator: (item: unknown, index: number) => T,
  opts: { minItems?: number; maxItems?: number } = {},
): T[] {
  if (!Array.isArray(value)) throw new AiResponseValidationError(field, '配列ではありません');
  if (opts.minItems !== undefined && value.length < opts.minItems) {
    throw new AiResponseValidationError(field, `最低${opts.minItems}件必要です（実際: ${value.length}件）`);
  }
  if (opts.maxItems !== undefined && value.length > opts.maxItems) {
    throw new AiResponseValidationError(field, `最大${opts.maxItems}件までです（実際: ${value.length}件）`);
  }
  return value.map((item, i) => itemValidator(item, i));
}
