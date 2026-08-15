import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateUlmDto {
  @IsOptional()
  @IsUUID()
  unitId?: string;

  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;
}
