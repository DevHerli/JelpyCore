import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  IsNumber,
  IsEmail,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSucursalNegocioDto {
  // ============================
  // RELACIONES
  // ============================
  @IsNumber()
  @Type(() => Number)
  @IsNotEmpty()
  negocioId: number;

  @IsNumber()
  @Type(() => Number)
  @IsNotEmpty()
  ciudadId: number;

  @IsNumber()
  @Type(() => Number)
  @IsNotEmpty()
  estadoId: number;

  // ============================
  // DATOS GENERALES
  // ============================
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nombreSucursal: string;

  // ============================
  // DIRECCIÓN
  // ============================
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  calle: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  numeroExterior: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  numeroInterior?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  colonia: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  entreCalle1?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  entreCalle2?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  codigoPostal: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  referenciaMapa?: string;

  // ============================
  // UBICACIÓN
  // ============================
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  latitud?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  longitud?: number;

  // ============================
  // CONTACTO
  // ============================
  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefonoFijo1?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefonoFijo2?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefonoFijo3?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefonoCelular1?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefonoCelular2?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefonoCelular3?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefonoCelular4?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(150)
  correoContacto?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  whatsapp?: string;

  // ============================
  // CONFIGURACIÓN
  // ============================
  @IsOptional()
  @IsString()
  @MaxLength(50)
  tipoSucursal?: string;

  @IsOptional()
  @IsBoolean()
  esMatriz?: boolean;

  // ============================
  // MEDIA
  // ============================
  @IsOptional()
  @IsString()
  @MaxLength(255)
  imagenUrl?: string;

  // ============================
  // RANGO DE PRECIOS
  // ============================
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(3)
  rangoPrecios?: number | null;
}