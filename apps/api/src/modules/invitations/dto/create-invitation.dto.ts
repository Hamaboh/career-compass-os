import { IsUUID } from 'class-validator';

export class CreateInvitationDto {
  @IsUUID()
  employeeId!: string;
}
