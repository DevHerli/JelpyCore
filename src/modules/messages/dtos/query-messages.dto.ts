import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export type MessageTypeFilter =
  | 'all'
  | 'payment'
  | 'report'
  | 'system'
  | 'promotion'
  | 'insight';

export class QueryMessagesDto {
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
  @IsEnum(['all', 'payment', 'report', 'system', 'promotion', 'insight'])
  type: MessageTypeFilter = 'all';
}
