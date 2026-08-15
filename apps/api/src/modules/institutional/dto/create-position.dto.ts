import { IsInt, IsString, Min, MinLength } from 'class-validator';

export class CreatePositionDto {
  @IsString()
  @MinLength(1)
  positionName!: string;

  @IsInt()
  @Min(0)
  positionLevel!: number;
}
