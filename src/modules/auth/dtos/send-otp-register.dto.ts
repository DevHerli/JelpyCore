import {
    IsString,
    IsNotEmpty,
    IsNumber,
    IsBoolean,
    Matches,
  } from 'class-validator';
  
  export class SendOtpRegisterDto {
    @IsString()
    @IsNotEmpty()
    nombre: string;
  
    @IsString()
    @IsNotEmpty()
    apellidoPaterno: string;
  
    @IsNumber()
    @IsNotEmpty()
    ciudadId: number;
  
    @IsString()
    @Matches(/^[0-9]{10}$/, {
      message: 'El número de teléfono debe tener 10 dígitos',
    })
    telefonoCelular: string;
  
    @IsBoolean()
    @IsNotEmpty()
    aceptoTerminos: boolean;
  }
  