import { randomBytes, createHash, timingSafeEqual, randomInt } from 'node:crypto';

/**
 * トークン/OTP生成・ハッシュ化のユーティリティ（Phase3 9〜11章、16.2節）。
 *
 * 方針:
 *   - 生トークン（招待リンク・セッションCookie・パスワードリセットリンクに載る値）は
 *     DB/Redisには一切保存しない。SHA-256ハッシュ値のみを保存し、照合時は受け取った値を
 *     同じ方法でハッシュ化してから比較する（DB漏洩時にトークンを復元不能にする）。
 *   - 比較はタイミング攻撃対策のため必ず定時間比較（timingSafeEqual）を使う。
 */

/** 256bit以上の暗号学的乱数トークンをBase64URLで返す（招待/セッション/パスワードリセット共通）。 */
export function generateOpaqueToken(): string {
  return randomBytes(32).toString('base64url');
}

/** SHA-256ハッシュの16進文字列。DB/Redisに保存する値はこれのみ。 */
export function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

/** 定時間比較。文字列長が異なる場合は先にfalseを返す（長さの比較自体はタイミング攻撃の対象にならない）。 */
export function safeCompareHex(aHex: string, bHex: string): boolean {
  const a = Buffer.from(aHex, 'hex');
  const b = Buffer.from(bHex, 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Phase3 10章: 6桁数字のOTP（暗号学的乱数、桁落ちしないよう0埋め）。 */
export function generateOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}
