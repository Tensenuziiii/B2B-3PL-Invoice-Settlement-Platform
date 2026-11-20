import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards,
} from "@nestjs/common";
import { Role } from "@prisma/client";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { CreateOwnerDto } from "./dto/create-owner.dto";
import { UpdateOwnerDto } from "./dto/update-owner.dto";
import { ListOwnersQueryDto } from "./dto/list-owners-query.dto";
import { OwnersService } from "./owners.service";

@ApiTags("owners")
@ApiBearerAuth()
@Controller("owners")
@UseGuards(JwtAuthGuard, RolesGuard)
export class OwnersController {
  constructor(private readonly ownersService: OwnersService) {}

  @Get()
  @Roles(Role.ADMIN, Role.DISPATCH_MANAGER, Role.ACCOUNTS, Role.STAFF, Role.VIEWER)
  @ApiOperation({ summary: "List truck owners with search and pagination" })
  list(@Query() query: ListOwnersQueryDto) {
    return this.ownersService.list(query);
  }

  @Get(":id")
  @Roles(Role.ADMIN, Role.DISPATCH_MANAGER, Role.ACCOUNTS, Role.STAFF, Role.VIEWER)
  @ApiOperation({ summary: "Get an owner by id" })
  get(@Param("id") id: string) {
    return this.ownersService.get(id);
  }

  @Post()
  @Roles(Role.ADMIN, Role.DISPATCH_MANAGER, Role.STAFF)
  @ApiOperation({ summary: "Create a truck owner" })
  create(@Body() dto: CreateOwnerDto) {
    return this.ownersService.create(dto);
  }

  @Patch(":id")
  @Roles(Role.ADMIN, Role.DISPATCH_MANAGER, Role.STAFF)
  @ApiOperation({ summary: "Update a truck owner" })
  update(@Param("id") id: string, @Body() dto: UpdateOwnerDto) {
    return this.ownersService.update(id, dto);
  }

  @Delete(":id")
  @Roles(Role.ADMIN, Role.DISPATCH_MANAGER)
  @ApiOperation({ summary: "Deactivate an owner (soft delete)" })
  deactivate(@Param("id") id: string) {
    return this.ownersService.deactivate(id);
  }
}
