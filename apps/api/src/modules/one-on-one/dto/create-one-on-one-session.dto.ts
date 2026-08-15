import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class CreateOneOnOneSessionDto {
  @IsUUID()
  employeeId!: string;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsUUID()
  prepSheetId?: string;
}
