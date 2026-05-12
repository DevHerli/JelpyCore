import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateTicketDto {
  @IsNotEmpty({ message: 'El campo tipo es requerido' })
  @IsEnum(['reporte_bug', 'solicitud_negocio'], {
    message: 'tipo debe ser reporte_bug o solicitud_negocio',
  })
  tipo: 'reporte_bug' | 'solicitud_negocio';

  // Solo para solicitud_negocio
  @IsOptional()
  @IsInt()
  @Min(1)
  negocio_id?: number;

  @IsNotEmpty({ message: 'El campo categoria es requerido' })
  @IsString()
  @MaxLength(60)
  categoria: string;

  @IsNotEmpty({ message: 'El campo categoria_label es requerido' })
  @IsString()
  @MaxLength(120)
  categoria_label: string;

  @IsNotEmpty({ message: 'El campo problema es requerido' })
  @IsString()
  @MaxLength(100)
  problema: string;

  @IsNotEmpty({ message: 'El campo problema_label es requerido' })
  @IsString()
  @MaxLength(200)
  problema_label: string;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  descripcion?: string;

  // reporte_bug lo ignora — el backend siempre fuerza 'normal'
  @IsOptional()
  @IsEnum(['normal', 'urgente'], {
    message: 'prioridad debe ser normal o urgente',
  })
  prioridad?: 'normal' | 'urgente';
}
