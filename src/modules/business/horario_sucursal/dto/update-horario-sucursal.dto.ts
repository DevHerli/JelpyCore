import { PartialType } from '@nestjs/mapped-types';
import { CreateHorarioSucursalDto } from './create-horario-sucursal.dto';

export class UpdateHorarioSucursalDto extends PartialType(CreateHorarioSucursalDto) {}
