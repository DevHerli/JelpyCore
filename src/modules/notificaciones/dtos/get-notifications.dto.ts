import { IsEnum, IsNumberString, IsOptional, IsString } from 'class-validator';

export class GetNotificationsDto {
  @IsOptional()
  @IsNumberString()
  page?: string;

  @IsOptional()
  @IsNumberString()
  per_page?: string;

  @IsOptional()
  @IsEnum(['traffic', 'government', 'community', 'ads', 'system'])
  category?: string;

  @IsOptional()
  @IsString()
  unread_only?: string;
}
