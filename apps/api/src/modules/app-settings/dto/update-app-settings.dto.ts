import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

/** ADM-09「アプリ設定」。Phase4 17.1節どおり、通知既定値・リマインド閾値のみを対象とする。 */
export class UpdateAppSettingsDto {
  @IsOptional()
  @IsBoolean()
  notificationDigestEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  defaultInterimCheckDays?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  defaultSmartRecheckDays?: number;
}
