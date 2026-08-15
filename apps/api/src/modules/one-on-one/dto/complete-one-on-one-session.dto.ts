import { IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

/** <one_on_one>「AIは最終判断をしない」の実装。notesはUL自身の言葉での実施記録（user_stated）。 */
export class CompleteOneOnOneSessionDto {
  @IsString()
  @MinLength(1)
  notes!: string;

  @IsOptional()
  @IsDateString()
  heldAt?: string;
}
