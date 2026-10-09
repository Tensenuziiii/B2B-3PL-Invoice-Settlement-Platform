import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Role } from "@prisma/client";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { CreateTripDto } from "./dto/create-trip.dto";
import { UpdateTripDto } from "./dto/update-trip.dto";
import { ListTripsQueryDto } from "./dto/list-trips-query.dto";
import { TripActionDto } from "./dto/trip-action.dto";
import { EndTripDto } from "./dto/end-trip.dto";
import { ArriveStopDto } from "./dto/arrive-stop.dto";
import { AuditTripDto } from "./dto/audit-trip.dto";
import { TripsService } from "./trips.service";

@ApiTags("trips")
@ApiBearerAuth()
@Controller("trips")
@UseGuards(JwtAuthGuard, RolesGuard)
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  @Get()
  @Roles(Role.ADMIN, Role.DISPATCH_MANAGER, Role.AUDITOR, Role.ACCOUNTS)
  @ApiOperation({ summary: "List trips" })
  list(@Query() query: ListTripsQueryDto) {
    return this.tripsService.list(query);
  }

  @Get(":id")
  @Roles(Role.ADMIN, Role.DISPATCH_MANAGER, Role.AUDITOR, Role.ACCOUNTS, Role.DRIVER)
  @ApiOperation({ summary: "Get a trip with stops" })
  get(@Param("id") id: string) {
    return this.tripsService.get(id);
  }

  @Post()
  @Roles(Role.ADMIN, Role.DISPATCH_MANAGER)
  @ApiOperation({ summary: "Create a trip with stops" })
  create(@Body() dto: CreateTripDto) {
    return this.tripsService.create(dto);
  }

  @Patch(":id")
  @Roles(Role.ADMIN, Role.DISPATCH_MANAGER)
  @ApiOperation({ summary: "Update a trip (only in ASSIGNED state)" })
  update(@Param("id") id: string, @Body() dto: UpdateTripDto) {
    return this.tripsService.update(id, dto);
  }

  @Delete(":id")
  @Roles(Role.ADMIN, Role.DISPATCH_MANAGER)
  @ApiOperation({ summary: "Soft-delete a trip (only in ASSIGNED state)" })
  softDelete(@Param("id") id: string) {
    return this.tripsService.softDelete(id);
  }

  @Post(":id/start")
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN, Role.DISPATCH_MANAGER, Role.DRIVER)
  @ApiOperation({ summary: "Start trip (ASSIGNED → IN_PROGRESS)" })
  start(@Param("id") id: string, @Body() dto: TripActionDto, @Req() req: any) {
    return this.tripsService.startTrip(id, dto, req.user);
  }

  @Post(":id/arrive")
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN, Role.DISPATCH_MANAGER, Role.DRIVER)
  @ApiOperation({ summary: "Arrive at a stop (IN_PROGRESS → DELIVERY_IN_PROGRESS on first)" })
  arrive(@Param("id") id: string, @Body() dto: ArriveStopDto, @Req() req: any) {
    return this.tripsService.arriveAtStop(id, dto, req.user);
  }

  @Post(":id/end")
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN, Role.DISPATCH_MANAGER, Role.DRIVER)
  @ApiOperation({ summary: "End trip with odometer (DELIVERY_IN_PROGRESS → DELIVERED)" })
  end(@Param("id") id: string, @Body() dto: EndTripDto, @Req() req: any) {
    return this.tripsService.endTrip(id, dto, req.user);
  }

  @Post(":id/close")
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN, Role.DISPATCH_MANAGER)
  @ApiOperation({ summary: "Close trip for audit (DELIVERED → AUDIT_PENDING)" })
  close(@Param("id") id: string, @Body() dto: TripActionDto, @Req() req: any) {
    return this.tripsService.closeTrip(id, dto, req.user);
  }

  @Post(":id/audit")
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN, Role.AUDITOR)
  @ApiOperation({ summary: "Audit trip (AUDIT_PENDING → AUDITED | CORRECTION_REQUESTED)" })
  audit(@Param("id") id: string, @Body() dto: AuditTripDto, @Req() req: any) {
    return this.tripsService.auditTrip(id, dto, req.user);
  }

  @Post(":id/resubmit")
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN, Role.DISPATCH_MANAGER, Role.DRIVER)
  @ApiOperation({ summary: "Resubmit corrected trip (CORRECTION_REQUESTED → AUDIT_PENDING)" })
  resubmit(@Param("id") id: string, @Body() dto: TripActionDto, @Req() req: any) {
    return this.tripsService.resubmitForAudit(id, dto, req.user);
  }

  @Post(":id/ready-for-billing")
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN, Role.ACCOUNTS)
  @ApiOperation({ summary: "Mark ready for billing (AUDITED → READY_FOR_BILLING)" })
  readyForBilling(@Param("id") id: string, @Body() dto: TripActionDto, @Req() req: any) {
    return this.tripsService.markReadyForBilling(id, dto, req.user);
  }
}
