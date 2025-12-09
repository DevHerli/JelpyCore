import { IsInt, IsOptional, IsString } from 'class-validator';

export class FilterPublicidadChatDto {
  @IsOptional()
  @IsString()
  ciudad?: string;

  @IsOptional()
  @IsInt()
  categoriaId?: number;

  @IsOptional()
  @IsInt()
  subcategoriaId?: number;

  @IsOptional()
  @IsString()
  texto?: string;
}
