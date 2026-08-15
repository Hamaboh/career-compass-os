import { IsString, MinLength } from 'class-validator';

export class CreateCompetencyDto {
  @IsString()
  @MinLength(1)
  competencyName!: string;
}
