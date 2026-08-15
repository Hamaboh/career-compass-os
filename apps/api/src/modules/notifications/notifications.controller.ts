import { Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentEmployee } from '../../common/decorators/current-employee.decorator';
import type { RequestContext } from '../../common/context/request-context';

/** <notification>要件: MEM-15 通知センター。Phase3 13.2節「通知」に対応するエンドポイント群。 */
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  @RequirePermission('SELF_DATA_VIEW')
  list(@Query() query: ListNotificationsQueryDto, @CurrentEmployee() ctx: RequestContext) {
    return this.service.listMine(ctx, query.unreadOnly === 'true');
  }

  @Patch(':id/read')
  @RequirePermission('SELF_DATA_VIEW')
  markRead(@Param('id') id: string, @CurrentEmployee() ctx: RequestContext) {
    return this.service.markRead(id, ctx);
  }

  @Post('read-all')
  @RequirePermission('SELF_DATA_VIEW')
  markAllRead(@CurrentEmployee() ctx: RequestContext) {
    return this.service.markAllRead(ctx);
  }
}
