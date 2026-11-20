import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { Role } from "@prisma/client";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { VendorSettlementsService } from "./vendor-settlements.service";
import { GenerateSettlementDto } from "./dto/generate-settlement.dto";
import { SettlementActionDto } from "./dto/settlement-action.dto";
import { ListSettlementsQueryDto } from "./dto/list-settlements-query.dto";

@ApiTags("vendor-settlements")
@ApiBearerAuth()
@Controller("vendor-settlements")
@UseGuards(JwtAuthGuard, RolesGuard)
export class VendorSettlementsController {
  constructor(private readonly service: VendorSettlementsService) {}

  @Get()
  @Roles(Role.ADMIN, Role.ACCOUNTS, Role.VENDOR_3PL)
  @ApiOperation({ summary: "List vendor settlements" })
  list(@Query() query: ListSettlementsQueryDto) {
    return this.service.list(query);
  }

  @Get(":id")
  @Roles(Role.ADMIN, Role.ACCOUNTS, Role.VENDOR_3PL)
  @ApiOperation({ summary: "Get vendor settlement detail" })
  get(@Param("id") id: string) {
    return this.service.get(id);
  }

  @Post()
  @Roles(Role.ADMIN, Role.ACCOUNTS)
  @ApiOperation({ summary: "Generate settlement from READY_FOR_BILLING trips" })
  create(@Body() dto: GenerateSettlementDto, @Req() req: any) {
    return this.service.create(dto, req.user.sub);
  }

  @Post(":id/submit")
  @Roles(Role.ADMIN, Role.ACCOUNTS)
  @ApiOperation({ summary: "Submit settlement (DRAFT → SUBMITTED)" })
  submit(@Param("id") id: string, @Body() dto: SettlementActionDto) {
    return this.service.submit(id, dto);
  }

  @Post(":id/approve")
  @Roles(Role.ADMIN, Role.ACCOUNTS)
  @ApiOperation({ summary: "Approve settlement (SUBMITTED → APPROVED)" })
  approve(@Param("id") id: string, @Body() dto: SettlementActionDto) {
    return this.service.approve(id, dto);
  }

  @Post(":id/mark-paid")
  @Roles(Role.ADMIN, Role.ACCOUNTS)
  @ApiOperation({ summary: "Mark settlement paid (APPROVED → PAID)" })
  markPaid(@Param("id") id: string, @Body() dto: SettlementActionDto) {
    return this.service.markPaid(id, dto);
  }
}
