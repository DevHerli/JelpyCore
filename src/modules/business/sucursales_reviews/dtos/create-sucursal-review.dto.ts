import { IsInt, IsNotEmpty, IsString, Max, Min } from 'class-validator';

export class CreateSucursalReviewDto {
  @IsInt()
  sucursalId: number;

  @IsInt()
  suscriptorId: number;

  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsString()
  @IsNotEmpty()
  comentario: string;
}
