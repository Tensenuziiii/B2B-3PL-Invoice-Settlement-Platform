import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { MarkArrivedDto } from './dto/mark-arrived.dto';
import { DriverService } from './driver.service';

@ApiTags('driver')
@Controller('driver')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class DriverController {
  constructor(private readonly driverService: DriverService) {}

  @Get('trips')
  @Roles('DRIVER')
  @ApiOperation({ summary: 'List trips assigned to the signed-in driver' })
  trips(@Req() request: { user: { sub: string } }) {
    return this.driverService.getAssignedTrips(request.user.sub);
  }

  @Patch('trips/:tripCode/arrive')
  @Roles('DRIVER')
  @ApiOperation({ summary: 'Mark an assigned trip as arrived' })
  markArrived(
    @Req() request: { user: { sub: string } },
    @Param('tripCode') tripCode: string,
    @Body() dto: MarkArrivedDto,
  ) {
    return this.driverService.markArrived(
      request.user.sub,
      tripCode,
      dto.version,
    );
  }
}