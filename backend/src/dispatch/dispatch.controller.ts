import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DispatchService } from './dispatch.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';

@ApiTags('dispatch')
@Controller('dispatch')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class DispatchController {
  constructor(private readonly dispatchService: DispatchService) {}

  @Get('overview')
  @Roles('DISPATCH_MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Return dispatch overview KPIs and fleet snapshot' })
  overview() {
    return this.dispatchService.getOverview();
  }

  @Get('fleet')
  @Roles('DISPATCH_MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'List fleet rows, with filter and search support' })
  fleet(
    @Query('status') status = 'ALL',
    @Query('search') search = '',
  ) {
    return this.dispatchService.getFleet(status, search);
  }

  @Get('eod-reconciliation')
  @Roles('DISPATCH_MANAGER', 'AUDITOR', 'ADMIN')
  @ApiOperation({ summary: 'List trips awaiting EOD reconciliation' })
  eodReconciliation() {
    return this.dispatchService.getEodReconciliation();
  }

  @Get('alerts')
  @Roles('DISPATCH_MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'List active dispatch alerts' })
  alerts() {
    return this.dispatchService.getAlerts();
  }

  @Get('notifications')
  @ApiOperation({ summary: 'List notifications for the signed-in user' })
  notifications(@Req() request: { user: { sub: string } }) {
    return this.dispatchService.getNotifications(request.user.sub);
  }
}
