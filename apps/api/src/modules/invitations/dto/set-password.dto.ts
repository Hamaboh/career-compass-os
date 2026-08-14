import { IsString, MinLength } from 'class-validator';

/**
 * 文字種・長さの本体ポリシーは common/security/password-policy.ts で検証する
 * （エラーメッセージをポリシー側に一元化するため、ここでは「文字列であること」のみ見る）。
 */
export class SetPasswordDto {
  @IsString()
  @MinLength(1)
  password!: string;

  @IsString()
  @MinLength(1)
  passwordConfirmation!: string;
}
