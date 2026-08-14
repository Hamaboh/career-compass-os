import { IsEmail, IsString, MinLength } from 'class-validator';

export class RequestPasswordResetDto {
  @IsEmail()
  email!: string;
}

export class ConfirmPasswordResetDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(1)
  password!: string;

  @IsString()
  @MinLength(1)
  passwordConfirmation!: string;
}
