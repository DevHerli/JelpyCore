import { IsIn, IsOptional, IsString } from 'class-validator';
import type { AnuncioStatus } from '../entities/anuncio.entity';

export class UpdateAnuncioStatusDto {
  @IsIn(['draft', 'active', 'paused', 'finished', 'rejected'])
  status: AnuncioStatus;

  @IsOptional()
  @IsString()
  reason?: string; 
}
