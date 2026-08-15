import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateKpiDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;
}
