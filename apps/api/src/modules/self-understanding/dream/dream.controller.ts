import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { DreamService } from './dream.service';
import { ReactToHypothesisDto } from './dto/react-to-hypothesis.dto';
import { PromoteToVisionDto } from './dto/promote-to-vision.dto';
import { CreateVisionDto } from './dto/create-vision.dto';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentEmployee } from '../../../common/decorators/current-employee.decorator';
import type { RequestContext } from '../../../common/context/request-context';

@Controller('dream-hypotheses')
export class DreamController {
  constructor(private readonly service: DreamService) {}

  @Post()
  @RequirePermission('SELF_DATA_EDIT')
  generate(@CurrentEmployee() ctx: RequestContext) {
    return this.service.generateHypotheses(ctx);
  }

  @Get()
  @RequirePermission('SELF_DATA_VIEW')
  list(@CurrentEmployee() ctx: RequestContext) {
    return this.service.listHypotheses(ctx);
  }

  @Post(':id/react')
  @RequirePermission('SELF_DATA_EDIT')
  react(@Param('id') id: string, @Body() dto: ReactToHypothesisDto, @CurrentEmployee() ctx: RequestContext) {
    return this.service.reactToHypothesis(id, dto, ctx);
  }

  @Post(':id/promote-to-vision')
  @RequirePermission('SELF_DATA_EDIT')
  promote(@Param('id') id: string, @Body() dto: PromoteToVisionDto, @CurrentEmployee() ctx: RequestContext) {
    return this.service.promoteToVision(id, dto, ctx);
  }
}

@Controller('visions')
export class VisionsController {
  constructor(private readonly service: DreamService) {}

  @Post()
  @RequirePermission('SELF_DATA_EDIT')
  create(@Body() dto: CreateVisionDto, @CurrentEmployee() ctx: RequestContext) {
    return this.service.createVisionDirectly(dto, ctx);
  }

  @Get()
  @RequirePermission('SELF_DATA_VIEW')
  list(@CurrentEmployee() ctx: RequestContext) {
    return this.service.listVisions(ctx);
  }

  @Get(':id')
  @RequirePermission('SELF_DATA_VIEW')
  get(@Param('id') id: string, @CurrentEmployee() ctx: RequestContext) {
    return this.service.getVision(id, ctx);
  }
}
