import { IsBooleanString, IsOptional } from 'class-validator';

export class ListNotificationsQueryDto {
  @IsOptional()
  @IsBooleanString()
  unreadOnly?: string;
}
