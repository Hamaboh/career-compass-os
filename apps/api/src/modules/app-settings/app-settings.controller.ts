import { Body, Controller, Get, Patch } from '@nestjs/common';
import { AppSettingsService } from './app-settings.service';
import { UpdateAppSettingsDto } from './dto/update-app-settings.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentEmployee } from '../../common/decorators/current-employee.decorator';
import type { RequestContext } from '../../common/context/request-context';

/** ADM-09「アプリ設定」。Phase3 7.1節 APP_SETTINGS_EDIT権限で保護する。 */
@Controller('app-settings')
export class AppSettingsController {
  constructor(private readonly service: AppSettingsService) {}

  @Get()
  @RequirePermission('LOGIN')
  get(@CurrentEmployee() ctx: RequestContext) {
    return this.service.get(ctx);
  }

  @Patch()
  @RequirePermission('APP_SETTINGS_EDIT')
  update(@Body() dto: UpdateAppSettingsDto, @CurrentEmployee() ctx: RequestContext) {
    return this.service.update(dto, ctx);
  }
}
