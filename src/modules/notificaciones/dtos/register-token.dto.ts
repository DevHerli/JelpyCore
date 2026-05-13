import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class RegisterTokenDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(512)
  token: string;

  @IsNotEmpty()
  @IsEnum(['ios', 'android', 'web'])
  platform: 'ios' | 'android' | 'web';

  @IsOptional()
  @IsString()
  @MaxLength(255)
  device_name?: string;
}
