import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { SucursalLikesService } from './sucursal-likes.service';

@Controller('likes')
export class SucursalLikesController {
  constructor(private readonly likesService: SucursalLikesService) {}

  /**
   * TOGGLE LIKE
   * Si ya tiene like → lo quita
   * Si no tiene → lo agrega
   *
   * Body:
   * {
   *   "usuarioId": number,
   *   "sucursalId": number
   * }
   */
  @Post('toggle')
  async toggle(@Body() body: any) {
    const { usuarioId, sucursalId } = body;

    if (!usuarioId || !sucursalId) {
      throw new BadRequestException('usuarioId y sucursalId son obligatorios');
    }

    const yaTieneLike = await this.likesService.usuarioHaDadoLike(
      usuarioId,
      sucursalId,
    );

    if (yaTieneLike) {
      // 👎 Quitar like
      const result = await this.likesService.quitarLike(usuarioId, sucursalId);
      return {
        exito: true,
        liked: result.liked,          // false
        totalLikes: result.totalLikes, // contador actualizado
        mensaje: 'Like removido correctamente',
      };
    }

    // 👍 Dar like
    const result = await this.likesService.darLike(usuarioId, sucursalId);
    return {
      exito: true,
      liked: result.liked,            // true
      totalLikes: result.totalLikes,  // contador actualizado
      mensaje: 'Like agregado correctamente',
    };
  }
}
