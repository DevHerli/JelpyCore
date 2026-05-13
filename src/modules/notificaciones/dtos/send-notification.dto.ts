import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class SendNotificationDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  title: string;

  @IsNotEmpty()
  @IsString()
  message: string;

  @IsOptional()
  @IsEnum(['traffic', 'government', 'community', 'ads', 'system'])
  category?: 'traffic' | 'government' | 'community' | 'ads' | 'system';

  @IsOptional()
  @IsEnum(['low', 'medium', 'high'])
  priority?: 'low' | 'medium' | 'high';

  @IsOptional()
  @IsString()
  @MaxLength(512)
  image_url?: string;

  @IsOptional()
  @IsEnum(['all', 'segment', 'individual'])
  target_type?: 'all' | 'segment' | 'individual';

  // city_id para segment | user_id para individual
  @IsOptional()
  @IsString()
  target_value?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  cta_label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  cta_route?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  cta_url?: string;
}
