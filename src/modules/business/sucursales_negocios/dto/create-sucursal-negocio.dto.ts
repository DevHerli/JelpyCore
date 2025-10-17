import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  IsNumber,
  IsEmail,
  IsBoolean,
} from 'class-validator';

export class CreateSucursalNegocioDto {
  @IsNumber()
  @IsNotEmpty()
  negocioId: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nombreSucursal: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  calle: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  numeroExterior: string;

  @IsString()
  @IsOptional()
  @MaxLength(10)
  numeroInterior?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  colonia: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  entreCalles?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  codigoPostal: string;

  @IsNumber()
  @IsNotEmpty()
  ciudadId: number;

  @IsNumber()
  @IsNotEmpty()
  estadoId: number;

  @IsOptional()
  latitud?: number;

  @IsOptional()
  longitud?: number;

  @IsOptional() @MaxLength(20) telefonoFijo1?: string;
  @IsOptional() @MaxLength(20) telefonoFijo2?: string;
  @IsOptional() @MaxLength(20) telefonoFijo3?: string;

  @IsOptional() @MaxLength(20) telefonoCelular1?: string;
  @IsOptional() @MaxLength(20) telefonoCelular2?: string;
  @IsOptional() @MaxLength(20) telefonoCelular3?: string;
  @IsOptional() @MaxLength(20) telefonoCelular4?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(150)
  correoContacto?: string;

  @IsOptional()
  @MaxLength(20)
  whatsapp?: string;

  @IsOptional()
  @IsBoolean()
  esMatriz?: boolean;
}
