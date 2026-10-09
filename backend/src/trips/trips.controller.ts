import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { Role } from "@prisma/client";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { CreateTripDto } from "./dto/create-trip.dto";
import { UpdateTripDto } from "./dto/update-trip.dto";
import { ListTripsQueryDto } from "./dto/list-trips-query.dto";
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
}
