import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { RemindersService } from './reminders.service';
import { CreateReminderDto } from './dto/create-reminder.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentEmployee } from '../../common/decorators/current-employee.decorator';
import type { RequestContext } from '../../common/context/request-context';

@Controller('reminders')
export class RemindersController {
  constructor(private readonly service: RemindersService) {}

  @Post()
  @RequirePermission('SELF_DATA_EDIT')
  create(@Body() dto: CreateReminderDto, @CurrentEmployee() ctx: RequestContext) {
    return this.service.createManual(dto, ctx);
  }

  @Get()
  @RequirePermission('SELF_DATA_VIEW')
  list(@CurrentEmployee() ctx: RequestContext) {
    return this.service.listMine(ctx);
  }

  @Get('due')
  @RequirePermission('SELF_DATA_VIEW')
  listDue(@CurrentEmployee() ctx: RequestContext) {
    return this.service.listDue(ctx);
  }

  @Post(':id/complete')
  @RequirePermission('SELF_DATA_EDIT')
  complete(@Param('id') id: string, @CurrentEmployee() ctx: RequestContext) {
    return this.service.markCompleted(id, ctx);
  }

  @Post(':id/skip')
  @RequirePermission('SELF_DATA_EDIT')
  skip(@Param('id') id: string, @CurrentEmployee() ctx: RequestContext) {
    return this.service.markSkipped(id, ctx);
  }
}
