/**
 * PostgreSQLの `SET LOCAL` はプレースホルダによるバインドパラメータを受け付けないため
 * （プロトコル上の制約）、PrismaService.withRlsContext ではRLSセッション変数の値を
 * SQL文字列に直接埋め込まざるを得ない。その際の唯一の防御として、値を厳格にホワイトリスト
 * 検証してから使う（Phase3 16.5節「生SQL/文字列結合によるSQLクエリ構築を機械的に禁止する」の
 * 例外として、ここだけは検証つきの直接埋め込みを許可する箇所であることを明示する）。
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function assertUuid(value: string): string {
  if (!UUID_RE.test(value)) {
    throw new Error(`assertUuid: value is not a valid UUID: ${JSON.stringify(value)}`);
  }
  return value;
}

export function assertOneOf<T extends string>(value: string, allowed: readonly T[]): T {
  if (!(allowed as readonly string[]).includes(value)) {
    throw new Error(`assertOneOf: value not in allowed set: ${JSON.stringify(value)}`);
  }
  return value as T;
}
