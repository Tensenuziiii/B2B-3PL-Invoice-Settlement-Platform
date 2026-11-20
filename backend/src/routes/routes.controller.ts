import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards,
} from "@nestjs/common";
import { Role } from "@prisma/client";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { CreateRouteDto } from "./dto/create-route.dto";
import { UpdateRouteDto } from "./dto/update-route.dto";
import { ListRoutesQueryDto } from "./dto/list-routes-query.dto";
import { RoutesService } from "./routes.service";

@ApiTags("routes")
@ApiBearerAuth()
@Controller("routes")
@UseGuards(JwtAuthGuard, RolesGuard)
export class RoutesController {
  constructor(private readonly routesService: RoutesService) {}

  @Get()
  @Roles(Role.ADMIN, Role.DISPATCH_MANAGER, Role.ACCOUNTS, Role.AUDITOR)
  @ApiOperation({ summary: "List routes with search and pagination" })
  list(@Query() query: ListRoutesQueryDto) {
    return this.routesService.list(query);
  }

  @Get(":id")
  @Roles(Role.ADMIN, Role.DISPATCH_MANAGER, Role.ACCOUNTS, Role.AUDITOR)
  @ApiOperation({ summary: "Get a route by id" })
  get(@Param("id") id: string) {
    return this.routesService.get(id);
  }

  @Post()
  @Roles(Role.ADMIN, Role.DISPATCH_MANAGER)
  @ApiOperation({ summary: "Create a route" })
  create(@Body() dto: CreateRouteDto) {
    return this.routesService.create(dto);
  }

  @Patch(":id")
  @Roles(Role.ADMIN, Role.DISPATCH_MANAGER)
  @ApiOperation({ summary: "Update a route" })
  update(@Param("id") id: string, @Body() dto: UpdateRouteDto) {
    return this.routesService.update(id, dto);
  }

  @Delete(":id")
  @Roles(Role.ADMIN, Role.DISPATCH_MANAGER)
  @ApiOperation({ summary: "Deactivate a route (soft delete)" })
  deactivate(@Param("id") id: string) {
    return this.routesService.deactivate(id);
  }
}
