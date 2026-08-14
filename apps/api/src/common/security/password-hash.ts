import * as argon2 from 'argon2';

/**
 * Phase3 3章「採用理由」でOWASP推奨のArgon2idを採用。パスワードは平文は勿論、
 * ログ・監査ログ・APIレスポンスのいずれにも一切出力しない（ユーザー制約<constraints>）。
 */
export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    // ハッシュ形式が不正な場合もfalseを返す（例外を認証失敗以外の情報として漏らさない）
    return false;
  }
}
