import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { InstitutionalService } from './institutional.service';
import { CreateKpiDto } from './dto/create-kpi.dto';
import { CreateUlmDto } from './dto/create-ulm.dto';
import { CreateInstitutionalConnectionDto } from './dto/create-institutional-connection.dto';
import { CreateEvaluationPeriodDto } from './dto/create-evaluation-period.dto';
import { CreateCompetencyDto } from './dto/create-competency.dto';
import { CreatePositionDto } from './dto/create-position.dto';
import { CreateInstitutionVersionDto, CreateUlmVersionDto } from './dto/create-institution-version.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentEmployee } from '../../common/decorators/current-employee.decorator';
import type { RequestContext } from '../../common/context/request-context';

@Controller('kpi-master')
export class KpiMasterController {
  constructor(private readonly service: InstitutionalService) {}

  @Post()
  @RequirePermission('COMPANY_POLICY_MANAGE')
  create(@Body() dto: CreateKpiDto, @CurrentEmployee() ctx: RequestContext) {
    return this.service.createKpi(dto, ctx);
  }

  @Get()
  @RequirePermission('LOGIN')
  list(@CurrentEmployee() ctx: RequestContext) {
    return this.service.listKpis(ctx);
  }

  @Get(':familyId/versions')
  @RequirePermission('LOGIN')
  listVersions(@Param('familyId') familyId: string, @CurrentEmployee() ctx: RequestContext) {
    return this.service.listKpiVersions(familyId, ctx);
  }

  @Post(':familyId/versions')
  @RequirePermission('COMPANY_POLICY_MANAGE')
  createVersion(
    @Param('familyId') familyId: string,
    @Body() dto: CreateInstitutionVersionDto,
    @CurrentEmployee() ctx: RequestContext,
  ) {
    return this.service.createKpiVersion(familyId, dto, ctx);
  }

  @Post(':id/publish')
  @RequirePermission('COMPANY_POLICY_MANAGE')
  publish(@Param('id') id: string, @CurrentEmployee() ctx: RequestContext) {
    return this.service.publishKpiVersion(id, ctx);
  }
}

@Controller('ulm-master')
export class UlmMasterController {
  constructor(private readonly service: InstitutionalService) {}

  @Post()
  @RequirePermission('COMPANY_POLICY_MANAGE')
  create(@Body() dto: CreateUlmDto, @CurrentEmployee() ctx: RequestContext) {
    return this.service.createUlm(dto, ctx);
  }

  @Get()
  @RequirePermission('LOGIN')
  list(@CurrentEmployee() ctx: RequestContext) {
    return this.service.listUlms(ctx);
  }

  @Get(':familyId/versions')
  @RequirePermission('LOGIN')
  listVersions(@Param('familyId') familyId: string, @CurrentEmployee() ctx: RequestContext) {
    return this.service.listUlmVersions(familyId, ctx);
  }

  @Post(':familyId/versions')
  @RequirePermission('COMPANY_POLICY_MANAGE')
  createVersion(
    @Param('familyId') familyId: string,
    @Body() dto: CreateUlmVersionDto,
    @CurrentEmployee() ctx: RequestContext,
  ) {
    return this.service.createUlmVersion(familyId, dto, ctx);
  }

  @Post(':id/publish')
  @RequirePermission('COMPANY_POLICY_MANAGE')
  publish(@Param('id') id: string, @CurrentEmployee() ctx: RequestContext) {
    return this.service.publishUlmVersion(id, ctx);
  }
}

/** ADM-06 人事評価制度管理（評価期間マスタ）。 */
@Controller('evaluation-periods')
export class EvaluationPeriodsController {
  constructor(private readonly service: InstitutionalService) {}

  @Post()
  @RequirePermission('COMPANY_POLICY_MANAGE')
  create(@Body() dto: CreateEvaluationPeriodDto, @CurrentEmployee() ctx: RequestContext) {
    return this.service.createEvaluationPeriod(dto, ctx);
  }

  @Get()
  @RequirePermission('LOGIN')
  list(@CurrentEmployee() ctx: RequestContext) {
    return this.service.listEvaluationPeriods(ctx);
  }
}

/** ADM-06 人事評価制度管理（能力マスタ）。 */
@Controller('competency-master')
export class CompetencyMasterController {
  constructor(private readonly service: InstitutionalService) {}

  @Post()
  @RequirePermission('COMPANY_POLICY_MANAGE')
  create(@Body() dto: CreateCompetencyDto, @CurrentEmployee() ctx: RequestContext) {
    return this.service.createCompetency(dto, ctx);
  }

  @Get()
  @RequirePermission('LOGIN')
  list(@CurrentEmployee() ctx: RequestContext) {
    return this.service.listCompetencies(ctx);
  }
}

/** ADM-06 人事評価制度管理（職位マスタ）。 */
@Controller('position-master')
export class PositionMasterController {
  constructor(private readonly service: InstitutionalService) {}

  @Post()
  @RequirePermission('COMPANY_POLICY_MANAGE')
  create(@Body() dto: CreatePositionDto, @CurrentEmployee() ctx: RequestContext) {
    return this.service.createPosition(dto, ctx);
  }

  @Get()
  @RequirePermission('LOGIN')
  list(@CurrentEmployee() ctx: RequestContext) {
    return this.service.listPositions(ctx);
  }
}

@Controller('institutional-connections')
export class InstitutionalConnectionsController {
  constructor(private readonly service: InstitutionalService) {}

  @Post()
  @RequirePermission('SELF_DATA_EDIT')
  create(@Body() dto: CreateInstitutionalConnectionDto, @CurrentEmployee() ctx: RequestContext) {
    return this.service.createConnection(dto, ctx);
  }

  @Get()
  @RequirePermission('SELF_DATA_VIEW')
  list(
    @Query('connectableType') connectableType: string | undefined,
    @Query('connectableId') connectableId: string | undefined,
    @CurrentEmployee() ctx: RequestContext,
  ) {
    if (connectableType && connectableId) {
      return this.service.listConnectionsForConnectable(connectableType, connectableId, ctx);
    }
    return this.service.listConnections(ctx);
  }
}
