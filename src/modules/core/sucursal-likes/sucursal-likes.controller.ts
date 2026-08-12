import { Controller, Post, Body, BadRequestException, Get, Query, Req, UseGuards } from '@nestjs/common';
import { SucursalLikesService } from './sucursal-likes.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';

@Controller('likes')
export class SucursalLikesController {
  constructor(private readonly likesService: SucursalLikesService) {}

  /**
   * TOGGLE LIKE
   * Si ya tiene like → lo quita
   * Si no tiene → lo agrega
   *
   * JLP-M22: la identidad (usuarioId) se deriva del token, NO del body,
   * para impedir suplantación de likes en nombre de otros usuarios.
   *
   * Body:
   * {
   *   "sucursalId": number
   * }
   */
  @UseGuards(JwtAuthGuard)
  @Post('toggle')
  async toggle(@Req() req: any, @Body() body: any) {
    const usuarioId = Number(req.user?.sub);
    const { sucursalId } = body;

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

  // ============================================================
  // CHECK LIKE
  // ============================================================

  /**
   * JLP-C14 — IDOR corregido: antes el `usuarioId` venía como query param
   * (cualquier atacante podía consultar el historial de likes de cualquier usuario).
   * Ahora se deriva del token JWT — el caller solo puede consultar su propio estado.
   *
   * GET /likes/check?sucursalId=42
   * Requiere: Authorization: Bearer <token>
   * Response: { liked: boolean, totalLikes: number }
   */
  @UseGuards(JwtAuthGuard)
  @Get('check')
  async check(
    @Query('sucursalId') sucursalId: number,
    @Req() req: any,
  ) {
    if (!sucursalId) {
      throw new BadRequestException('sucursalId es obligatorio');
    }

    // La identidad viene del token — nunca del query param.
    const usuarioId = Number(req.user?.sub);

    const liked = await this.likesService.usuarioHaDadoLike(
      usuarioId,
      Number(sucursalId),
    );

    const totalLikes = await this.likesService.contar(Number(sucursalId));

    return {
      liked,
      totalLikes,
    };
  }
}
