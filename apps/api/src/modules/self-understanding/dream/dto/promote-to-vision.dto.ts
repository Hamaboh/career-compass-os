import { IsOptional, IsString, MinLength } from 'class-validator';

export class PromoteToVisionDto {
  /** 未指定の場合は仮説の本文をそのままVisionの内容とする。 */
  @IsOptional()
  @IsString()
  @MinLength(1)
  content?: string;
}
