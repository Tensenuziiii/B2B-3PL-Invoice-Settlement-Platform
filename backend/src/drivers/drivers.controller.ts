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
@Roles(Role.ADMIN, Role.DISPATCH_MANAGER)
export class DriversController {
  constructor(private readonly driversService: DriversService) {}

  @Get()
  @ApiOperation({ summary: "List drivers with search and pagination" })
  list(@Query() query: ListDriversQueryDto) {
    return this.driversService.list(query);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a driver by id" })
  get(@Param("id") id: string) {
    return this.driversService.get(id);
  }

  @Post()
  @ApiOperation({ summary: "Create a driver" })
  create(@Body() dto: CreateDriverDto) {
    return this.driversService.create(dto);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a driver" })
  update(@Param("id") id: string, @Body() dto: UpdateDriverDto) {
    return this.driversService.update(id, dto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Deactivate a driver (soft delete)" })
  deactivate(@Param("id") id: string) {
    return this.driversService.deactivate(id);
  }
}
