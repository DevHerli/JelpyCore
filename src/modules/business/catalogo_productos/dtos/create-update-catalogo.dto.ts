import { IsString, IsNumber, IsOptional, IsBoolean, IsEnum } from 'class-validator';

// --- CATEGORÍAS ---
export class CreateCategoriaDto {
  @IsNumber()
  negocioId: number;

  @IsString()
  nombre: string;
}

// --- ITEMS GLOBALES ---
export class CreateItemNegocioDto {
  @IsNumber()
  negocioId: number;

  @IsNumber()
  @IsOptional()
  categoriaId?: number;

  @IsString()
  nombre: string;

  @IsString()
  @IsOptional()
  descripcion?: string;

  @IsNumber() // O IsString si envías decimales como texto desde front
  precioBase: number;

  @IsEnum(['producto', 'servicio'])
  tipo: 'producto' | 'servicio';

  @IsNumber()
  @IsOptional()
  duracionMinutos?: number;
}

// --- CONFIGURACIÓN SUCURSAL ---
export class UpdateItemSucursalDto {
  @IsNumber()
  sucursalId: number;

  @IsNumber()
  itemNegocioId: number;

  @IsNumber()
  @IsOptional()
  precioEspecifico?: number; // Enviar null para resetear al precio base

  @IsBoolean()
  disponible: boolean;
}