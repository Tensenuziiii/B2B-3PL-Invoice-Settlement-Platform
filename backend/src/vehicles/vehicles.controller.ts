import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards,
} from "@nestjs/common";
import { Role } from "@prisma/client";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { CreateVehicleDto } from "./dto/create-vehicle.dto";
import { UpdateVehicleDto } from "./dto/update-vehicle.dto";
import { ListVehiclesQueryDto } from "./dto/list-vehicles-query.dto";
import { VehiclesService } from "./vehicles.service";

@ApiTags("vehicles")
@ApiBearerAuth()
@Controller("vehicles")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.DISPATCH_MANAGER)
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Get()
  @ApiOperation({ summary: "List vehicles with search and pagination" })
  list(@Query() query: ListVehiclesQueryDto) {
    return this.vehiclesService.list(query);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a vehicle by id" })
  get(@Param("id") id: string) {
    return this.vehiclesService.get(id);
  }

  @Post()
  @ApiOperation({ summary: "Create a vehicle" })
  create(@Body() dto: CreateVehicleDto) {
    return this.vehiclesService.create(dto);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a vehicle" })
  update(@Param("id") id: string, @Body() dto: UpdateVehicleDto) {
    return this.vehiclesService.update(id, dto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Deactivate a vehicle (soft delete)" })
  deactivate(@Param("id") id: string) {
    return this.vehiclesService.deactivate(id);
  }
}
