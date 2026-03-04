import { IsString, IsNotEmpty } from 'class-validator';

export class RespondReviewDto {
  @IsString()
  @IsNotEmpty()
  respuesta: string;
}
