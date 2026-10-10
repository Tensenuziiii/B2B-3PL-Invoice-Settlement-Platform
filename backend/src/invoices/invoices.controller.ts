import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { Role } from "@prisma/client";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { InvoicesService } from "./invoices.service";
import { BillingService } from "../billing/billing.service";
import { GenerateInvoiceDto } from "../billing/dto/generate-invoice.dto";
import { ListInvoicesQueryDto } from "./dto/list-invoices-query.dto";
import { InvoiceActionDto } from "./dto/invoice-action.dto";

@ApiTags("invoices")
@ApiBearerAuth()
@Controller("invoices")
@UseGuards(JwtAuthGuard, RolesGuard)
export class InvoicesController {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly billingService: BillingService,
  ) {}

  @Get()
  @Roles(Role.ADMIN, Role.ACCOUNTS, Role.CLIENT_AP)
  @ApiOperation({ summary: "List invoices" })
  list(@Query() query: ListInvoicesQueryDto, @Req() req: any) {
    // CLIENT_AP users are scoped to their own client — inject clientId filter if applicable
    if (req.user.role === "CLIENT_AP" && req.user.clientId) {
      query.clientId = req.user.clientId;
    }
    return this.invoicesService.list(query);
  }

  @Get(":id")
  @Roles(Role.ADMIN, Role.ACCOUNTS, Role.CLIENT_AP)
  @ApiOperation({ summary: "Get invoice detail" })
  get(@Param("id") id: string) {
    return this.invoicesService.get(id);
  }

  @Post()
  @Roles(Role.ADMIN, Role.ACCOUNTS)
  @ApiOperation({ summary: "Generate a new invoice from READY_FOR_BILLING trips" })
  create(@Body() dto: GenerateInvoiceDto, @Req() req: any) {
    return this.billingService.generateInvoice(dto, req.user.sub);
  }

  @Post(":id/submit")
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN, Role.ACCOUNTS)
  @ApiOperation({ summary: "Submit invoice (DRAFT → SUBMITTED)" })
  submit(@Param("id") id: string, @Body() dto: InvoiceActionDto, @Req() req: any) {
    return this.invoicesService.submit(id, dto, req.user);
  }

  @Post(":id/send-to-client")
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN, Role.ACCOUNTS)
  @ApiOperation({ summary: "Send invoice to client (SUBMITTED → CLIENT_REVIEW)" })
  sendToClient(@Param("id") id: string, @Body() dto: InvoiceActionDto, @Req() req: any) {
    return this.invoicesService.sendToClient(id, dto, req.user);
  }

  @Post(":id/approve")
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN, Role.CLIENT_AP)
  @ApiOperation({ summary: "Approve invoice (CLIENT_REVIEW → APPROVED)" })
  approve(@Param("id") id: string, @Body() dto: InvoiceActionDto, @Req() req: any) {
    return this.invoicesService.approve(id, dto, req.user);
  }

  @Post(":id/reject")
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN, Role.CLIENT_AP)
  @ApiOperation({ summary: "Reject invoice (CLIENT_REVIEW → REJECTED)" })
  reject(@Param("id") id: string, @Body() dto: InvoiceActionDto, @Req() req: any) {
    return this.invoicesService.reject(id, dto, req.user);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN, Role.ACCOUNTS)
  @ApiOperation({ summary: "Cancel invoice (DRAFT → CANCELLED, soft delete)" })
  cancel(@Param("id") id: string, @Body() dto: InvoiceActionDto, @Req() req: any) {
    return this.invoicesService.cancel(id, dto, req.user);
  }
}
