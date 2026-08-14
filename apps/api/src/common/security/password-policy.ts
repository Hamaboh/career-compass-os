/**
 * パスワードポリシー（ユーザー要件 <password> / Phase3 12章）。
 *
 *   - 最低8文字、8文字未満は拒否
 *   - 英数字は使用可能、英数字のみでも可（大文字・小文字・数字・記号の混在は必須にしない）
 *   - 記号は任意（安全な記号セットのみ許可し、扱いに困る制御文字等は拒否）
 *   - 平文はどこにも保存しない（保存するのはargon2idハッシュのみ、hash.tsを参照）
 */

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

/** 英数字 + 安全な記号セット。制御文字・空白・バッククォート等の紛らわしい記号は含めない。 */
const ALLOWED_CHARS_RE = /^[A-Za-z0-9!@#$%^&*()\-_=+[\]{};:,.<>/?~]+$/;

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

export function validatePasswordPolicy(password: string): PasswordValidationResult {
  const errors: string[] = [];

  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`パスワードは${PASSWORD_MIN_LENGTH}文字以上で入力してください`);
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    errors.push(`パスワードは${PASSWORD_MAX_LENGTH}文字以下で入力してください`);
  }
  if (password.length > 0 && !ALLOWED_CHARS_RE.test(password)) {
    errors.push('パスワードに使用できない文字が含まれています（半角英数字と一部の記号のみ使用できます）');
  }

  return { valid: errors.length === 0, errors };
}

export type PasswordStrength = 'weak' | 'medium' | 'strong' | 'very_strong';

/**
 * 強度表示用の簡易スコアリング（外部ライブラリに依存しない長さ＋文字種の多様性ベース）。
 * ポリシー違反（8文字未満等）を判定するものではない。UIでの参考表示専用。
 */
export function estimatePasswordStrength(password: string): PasswordStrength {
  if (password.length < PASSWORD_MIN_LENGTH) return 'weak';

  let varietyScore = 0;
  if (/[a-z]/.test(password)) varietyScore++;
  if (/[A-Z]/.test(password)) varietyScore++;
  if (/[0-9]/.test(password)) varietyScore++;
  if (/[^A-Za-z0-9]/.test(password)) varietyScore++;

  const lengthScore = password.length >= 16 ? 2 : password.length >= 12 ? 1 : 0;
  const total = varietyScore + lengthScore;

  if (total >= 5) return 'very_strong';
  if (total >= 3) return 'strong';
  if (total >= 2) return 'medium';
  return 'weak';
}
