import { IsOptional, IsString, IsEnum } from 'class-validator';

export class CreateReporteModeracionDto {
  @IsString()
  mensajeOriginal: string;

  @IsOptional()
  @IsString()
  mensajeCorregido?: string;

  @IsString()
  motivo: string;

  @IsEnum(['grosería', 'amenaza', 'violencia', 'otro'])
  tipo: 'grosería' | 'amenaza' | 'violencia' | 'otro';

  @IsOptional()
  @IsString()
  idSuscriptor?: string;

  @IsOptional()
  @IsString()
  ipUsuario?: string;

  @IsOptional()
  @IsString()
  userAgent?: string;

  @IsOptional()
  @IsString()
  observaciones?: string;
}
