import { PartialType } from '@nestjs/mapped-types';
import { CreatePromocionSucursalDto } from './create-promocion-sucursal.dto';

export class UpdatePromocionSucursalDto extends PartialType(CreatePromocionSucursalDto) {}
