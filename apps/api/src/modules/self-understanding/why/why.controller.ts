import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { WhyService } from './why.service';
import { SubjectQueryDto } from './dto/subject-query.dto';
import { SubmitWhyDto } from './dto/submit-why.dto';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentEmployee } from '../../../common/decorators/current-employee.decorator';
import type { RequestContext } from '../../../common/context/request-context';

@Controller('why-records')
export class WhyController {
  constructor(private readonly service: WhyService) {}

  @Get()
  @RequirePermission('SELF_DATA_VIEW')
  list(@Query() query: SubjectQueryDto, @CurrentEmployee() ctx: RequestContext) {
    return this.service.listForSubject(query.subjectType, query.subjectId, ctx);
  }

  @Get('probe')
  @RequirePermission('SELF_DATA_VIEW')
  probe(@Query() query: SubjectQueryDto, @CurrentEmployee() ctx: RequestContext) {
    return this.service.probe(query.subjectType, query.subjectId, ctx);
  }

  @Post()
  @RequirePermission('SELF_DATA_EDIT')
  submit(@Body() dto: SubmitWhyDto, @CurrentEmployee() ctx: RequestContext) {
    return this.service.submitAnswer(dto.subjectType, dto.subjectId, dto.userText, ctx);
  }
}
