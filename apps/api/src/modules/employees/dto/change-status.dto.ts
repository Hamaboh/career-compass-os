import { IsIn, IsOptional, IsString } from 'class-validator';

const CHANGEABLE_STATUSES = ['active', 'suspended', 'deactivated'] as const;

/**
 * Phase3 16.6節: active以外への変更は全セッション即時失効のトリガーになる。
 * pending/lockedはシステム内部の遷移（招待完了・ログイン失敗ロック）であり、
 * Adminがこのエンドポイントから直接指定するものではないため対象外とする。
 */
export class ChangeStatusDto {
  @IsIn(CHANGEABLE_STATUSES)
  accountStatus!: (typeof CHANGEABLE_STATUSES)[number];

  @IsOptional()
  @IsString()
  reason?: string;
}
