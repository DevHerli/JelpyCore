import { PartialType } from '@nestjs/mapped-types';
import { CreateSuscriptorDto } from './create-suscriptor.dto';

export class UpdateSuscriptorDto extends PartialType(CreateSuscriptorDto) {}
