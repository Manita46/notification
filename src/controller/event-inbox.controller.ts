import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { NotificationRepo } from '../repo/notification.repo';

@Controller('internal')
export class EventInboxController {
  constructor(private readonly repo: NotificationRepo) {}

  @Get('events')
  async list(
    @Query('search') search?: string,
    @Query('date') date?: string,
    @Query('channel') channel?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const lim = limit ? Number(limit) : 50;
    const off = offset ? Number(offset) : 0;

    if (!Number.isFinite(lim) || lim <= 0 || lim > 500) {
      throw new BadRequestException('limit must be 1..500');
    }
    if (!Number.isFinite(off) || off < 0) {
      throw new BadRequestException('offset must be >= 0');
    }

    return this.repo.getEventInboxList({
      search,
      date,
      channel,
      limit: lim,
      offset: off,
    });
  }
}
