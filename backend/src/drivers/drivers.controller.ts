import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards,
} from "@nestjs/common";
import { Role } from "@prisma/client";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { CreateDriverDto } from "./dto/create-driver.dto";
import { UpdateDriverDto } from "./dto/update-driver.dto";
import { ListDriversQueryDto } from "./dto/list-drivers-query.dto";
import { DriversService } from "./drivers.service";

@ApiTags("drivers")
@ApiBearerAuth()
@Controller("drivers")
@UseGuards(JwtAuthGuard, RolesGuard)
export class DriversController {
  constructor(private readonly driversService: DriversService) {}

  @Get()
  @Roles(Role.ADMIN, Role.DISPATCH_MANAGER, Role.ACCOUNTS, Role.STAFF, Role.VIEWER)
  @ApiOperation({ summary: "List drivers with search and pagination" })
  list(@Query() query: ListDriversQueryDto) {
    return this.driversService.list(query);
  }

  @Get(":id")
  @Roles(Role.ADMIN, Role.DISPATCH_MANAGER, Role.ACCOUNTS, Role.STAFF, Role.VIEWER)
  @ApiOperation({ summary: "Get a driver by id" })
  get(@Param("id") id: string) {
    return this.driversService.get(id);
  }

  @Post()
  @Roles(Role.ADMIN, Role.DISPATCH_MANAGER, Role.STAFF)
  @ApiOperation({ summary: "Create a driver" })
  create(@Body() dto: CreateDriverDto) {
    return this.driversService.create(dto);
  }

  @Patch(":id")
  @Roles(Role.ADMIN, Role.DISPATCH_MANAGER, Role.STAFF)
  @ApiOperation({ summary: "Update a driver" })
  update(@Param("id") id: string, @Body() dto: UpdateDriverDto) {
    return this.driversService.update(id, dto);
  }

  @Delete(":id")
  @Roles(Role.ADMIN, Role.DISPATCH_MANAGER)
  @ApiOperation({ summary: "Deactivate a driver (soft delete)" })
  deactivate(@Param("id") id: string) {
    return this.driversService.deactivate(id);
  }
}
