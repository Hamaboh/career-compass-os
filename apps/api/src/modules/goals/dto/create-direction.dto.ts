import { IsString, IsUUID, MinLength } from 'class-validator';

export class CreateDirectionDto {
  @IsUUID()
  visionId!: string;

  @IsString()
  @MinLength(1)
  content!: string;
}
