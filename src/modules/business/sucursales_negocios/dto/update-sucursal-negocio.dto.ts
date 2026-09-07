import { PartialType, OmitType } from '@nestjs/mapped-types';
import { IsEmail, IsNotEmpty, IsOptional, Matches, MaxLength } from 'class-validator';
import { CreateSucursalNegocioDto } from './create-sucursal-negocio.dto';

/**
 * UpdateSucursalNegocioDto — PUT /sucursales/:id
 *
 * Reglas particulares que DIFIEREN de CreateSucursalNegocioDto:
 *
 *  - correoContacto: sigue siendo OPCIONAL (permite editar sucursales
 *    heredadas que se dieron de alta sin correo), pero ahora con mensaje
 *    de validación explícito.
 *
 *  - telefonoCelular1: se vuelve OBLIGATORIO al actualizar. Nota: la
 *    columna `telefono_celular1` en BD sigue siendo nullable (hay 8
 *    sucursales activas heredadas sin este dato — ver auditoría del
 *    2026-09-05). No se migra a NOT NULL para no romper esos registros;
 *    la obligatoriedad se aplica solo aquí, a nivel de DTO.
 *
 * Truco necesario: PartialType() marca automáticamente TODAS las
 * propiedades de CreateSucursalNegocioDto como @IsOptional() (incluida
 * telefonoCelular1). class-validator agrega los decoradores por nombre de
 * propiedad a través de toda la cadena de prototipos, así que simplemente
 * redeclarar telefonoCelular1 con @IsNotEmpty() en una subclase NO
 * sobrescribe el @IsOptional() heredado — el campo seguiría
 * saltándose la validación cuando viene undefined. Por eso primero se
 * omite el campo de la fuente con OmitType(...) antes de aplicar
 * PartialType(...), y luego se redeclara desde cero con los decoradores
 * estrictos deseados.
 */
export class UpdateSucursalNegocioDto extends PartialType(
  OmitType(CreateSucursalNegocioDto, [
    'telefonoCelular1',
    'correoContacto',
  ] as const),
) {
  @IsNotEmpty({ message: 'El teléfono celular es obligatorio' })
  @Matches(/^\d{10,15}$/, {
    message: 'El teléfono celular debe tener entre 10 y 15 dígitos',
  })
  telefonoCelular1: string;

  @IsOptional()
  @IsEmail({}, { message: 'correoContacto debe ser un email válido' })
  @MaxLength(150)
  correoContacto?: string;
}
