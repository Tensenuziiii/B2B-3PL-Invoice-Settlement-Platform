import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { Role } from "@prisma/client";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { CreateRateCardDto } from "./dto/create-rate-card.dto";
import { UpdateRateCardDto } from "./dto/update-rate-card.dto";
import { AddRateCardItemDto } from "./dto/add-rate-card-item.dto";
import { ListRateCardsQueryDto } from "./dto/list-rate-cards-query.dto";
import { ResolveRateDto } from "./dto/resolve-rate.dto";
import { RateCardsService } from "./rate-cards.service";

@ApiTags("rate-cards")
@ApiBearerAuth()
@Controller("rate-cards")
@UseGuards(JwtAuthGuard, RolesGuard)
export class RateCardsController {
  constructor(private readonly rateCardsService: RateCardsService) {}

  @Get()
  @Roles(Role.ADMIN, Role.DISPATCH_MANAGER, Role.ACCOUNTS, Role.AUDITOR)
  @ApiOperation({ summary: "List rate cards" })
  list(@Query() query: ListRateCardsQueryDto) {
    return this.rateCardsService.list(query);
  }

  @Post("resolve")
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN, Role.DISPATCH_MANAGER, Role.ACCOUNTS, Role.AUDITOR)
  @ApiOperation({ summary: "Resolve the applicable rate card item for a trip context" })
  resolve(@Body() dto: ResolveRateDto) {
    return this.rateCardsService.resolve(dto);
  }

  @Get(":id")
  @Roles(Role.ADMIN, Role.DISPATCH_MANAGER, Role.ACCOUNTS, Role.AUDITOR)
  @ApiOperation({ summary: "Get a rate card with items" })
  get(@Param("id") id: string) {
    return this.rateCardsService.get(id);
  }

  @Post()
  @Roles(Role.ADMIN, Role.ACCOUNTS)
  @ApiOperation({ summary: "Create a rate card with nested items" })
  create(@Body() dto: CreateRateCardDto) {
    return this.rateCardsService.create(dto);
  }

  @Patch(":id")
  @Roles(Role.ADMIN, Role.ACCOUNTS)
  @ApiOperation({ summary: "Update a rate card header (items are append-only)" })
  update(@Param("id") id: string, @Body() dto: UpdateRateCardDto) {
    return this.rateCardsService.update(id, dto);
  }

  @Post(":id/items")
  @Roles(Role.ADMIN, Role.ACCOUNTS)
  @ApiOperation({ summary: "Append a new item to a rate card" })
  addItem(@Param("id") id: string, @Body() dto: AddRateCardItemDto) {
    return this.rateCardsService.addItem(id, dto);
  }

  @Delete(":id")
  @Roles(Role.ADMIN, Role.ACCOUNTS)
  @ApiOperation({ summary: "Deactivate a rate card (soft delete)" })
  deactivate(@Param("id") id: string) {
    return this.rateCardsService.deactivate(id);
  }
}
