import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export type InboxSourceFilter = 'all' | 'messages' | 'notifications' | 'tickets';

export class QueryInboxDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  per_page: number = 30;

  @IsOptional()
  @IsEnum(['all', 'messages', 'notifications', 'tickets'])
  source: InboxSourceFilter = 'all';

  @IsOptional()
  @IsString()
  unread_only?: string;

  @IsOptional()
  @IsString()
  q?: string;
}
