import { IsString, MinLength } from 'class-validator';

/** 夢探索を経ずに本人が直接Visionを書く経路（Phase2 2.4節、必須ではない経路）。 */
export class CreateVisionDto {
  @IsString()
  @MinLength(1)
  content!: string;
}
