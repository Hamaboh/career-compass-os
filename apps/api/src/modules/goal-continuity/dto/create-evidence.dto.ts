import { IsOptional, IsString, IsUrl, MinLength } from 'class-validator';

/** <goal_management>「成果物」。Actionに対する完了の証跡。 */
export class CreateEvidenceDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUrl()
  url?: string;
}
