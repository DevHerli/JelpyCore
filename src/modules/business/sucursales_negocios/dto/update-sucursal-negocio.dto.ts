import { PartialType } from '@nestjs/mapped-types';
import { CreateSucursalNegocioDto } from './create-sucursal-negocio.dto';

export class UpdateSucursalNegocioDto extends PartialType(CreateSucursalNegocioDto) {}
