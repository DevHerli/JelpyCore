import { IsIn } from 'class-validator';

export class ReaccionSucursalReviewDto {
  @IsIn(['like', 'dislike'])
  tipo: 'like' | 'dislike';
}
