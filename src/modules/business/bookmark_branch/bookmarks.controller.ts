import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { BookmarksService } from './bookmarks.service';

@Controller('bookmarks')
export class BookmarksController {
  constructor(private readonly bookmarksService: BookmarksService) {}

  @Post('toggle')
  toggle(
    @Body('sucursalId') sucursalId: number,
    @Body('suscriptorId') suscriptorId: number,
  ) {
    return this.bookmarksService.toggle(Number(sucursalId), Number(suscriptorId));
  }

  @Get('user/:suscriptorId')
  findByUser(@Param('suscriptorId') suscriptorId: number) {
    return this.bookmarksService.findByUser(Number(suscriptorId));
  }

  @Get('check/:sucursalId/:suscriptorId')
  check(
    @Param('sucursalId') sucursalId: number,
    @Param('suscriptorId') suscriptorId: number,
  ) {
    return this.bookmarksService.isBookmarked(
      Number(sucursalId),
      Number(suscriptorId),
    );
  }
}