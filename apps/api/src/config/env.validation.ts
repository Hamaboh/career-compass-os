import { plainToInstance } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, Max, Min, validateSync } from 'class-validator';

/**
 * .env.example に対応する起動時バリデーション。不足・不正な値があれば起動時に例外で落とす
 * （実行時に初めて気づく事故を防ぐ、Phase3の「シークレットはコミットしない」方針と対になる規約）。
 */
class EnvironmentVariables {
  @IsOptional()
  @IsIn(['development', 'production', 'test'])
  NODE_ENV?: string;

  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsNotEmpty()
  REDIS_URL!: string;

  @IsNotEmpty()
  SESSION_COOKIE_NAME!: string;

  @IsInt()
  @Min(1)
  @Max(24)
  SESSION_TTL_HOURS!: number;

  @IsNotEmpty()
  CSRF_COOKIE_NAME!: string;

  @IsInt()
  @Min(1)
  INVITATION_TOKEN_TTL_HOURS!: number;

  @IsInt()
  @Min(1)
  OTP_TTL_MINUTES!: number;

  @IsInt()
  @Min(1)
  OTP_MAX_ATTEMPTS!: number;

  @IsInt()
  @Min(1)
  OTP_RESEND_COOLDOWN_SECONDS!: number;

  @IsInt()
  @Min(1)
  PASSWORD_RESET_TOKEN_TTL_MINUTES!: number;

  @IsInt()
  @Min(1)
  LOGIN_LOCK_THRESHOLD!: number;

  @IsInt()
  @Min(1)
  LOGIN_LOCK_WINDOW_MINUTES!: number;

  @IsInt()
  @Min(1)
  LOGIN_LOCK_DURATION_MINUTES!: number;

  /**
   * Phase3 14章。未設定でも起動は許容する（AI機能を使わないローカル開発/CI/既存機能のテストを
   * ブロックしないため、MailServiceのSMTP_HOST未設定時フォールバックと同じ考え方）。
   * 実際にAiOrchestrationServiceが呼び出された時点で未設定なら例外を投げる（コード側で明示）。
   */
  @IsOptional()
  @IsNotEmpty()
  ANTHROPIC_API_KEY?: string;

  @IsOptional()
  @IsNotEmpty()
  ANTHROPIC_MODEL?: string;
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(`環境変数の検証に失敗しました:\n${errors.toString()}`);
  }
  return validated;
}
