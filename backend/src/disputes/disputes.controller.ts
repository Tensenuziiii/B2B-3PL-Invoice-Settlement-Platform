import { Body, Controller, Get, NotFoundException, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { Role } from "@prisma/client";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { getTenant } from "../core/tenant/tenant.context";
import { DisputesService } from "./disputes.service";
import { CreateDisputeDto } from "./dto/create-dispute.dto";
import { UpdateDisputeStatusDto } from "./dto/update-dispute-status.dto";
import { ResolveDisputeDto } from "./dto/resolve-dispute.dto";
import { ListDisputesQueryDto } from "./dto/list-disputes-query.dto";
import { PostMessageDto } from "./dto/post-message.dto";

@ApiTags("disputes")
@ApiBearerAuth()
@Controller("disputes")
@UseGuards(JwtAuthGuard, RolesGuard)
export class DisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  @Get()
  @Roles(Role.ADMIN, Role.ACCOUNTS, Role.CLIENT_AP, Role.AUDITOR)
  @ApiOperation({ summary: "List disputes" })
  async list(@Query() query: ListDisputesQueryDto, @Req() req?: any) {
    const result = await this.disputesService.list(query);
    const orgId = getTenant()?.organizationId ?? req?.user?.orgId;
    if (orgId && result?.data) {
      result.data = result.data.filter((d: any) => d.organizationId === orgId);
      result.meta.total = result.data.length;
    }
    return result;
  }

  @Get(":id")
  @Roles(Role.ADMIN, Role.ACCOUNTS, Role.CLIENT_AP, Role.AUDITOR)
  @ApiOperation({ summary: "Get dispute detail with messages" })
  async get(@Param("id") id: string, @Req() req?: any) {
    const dispute = await this.disputesService.get(id);
    const orgId = getTenant()?.organizationId ?? req?.user?.orgId;
    if (orgId && dispute.organizationId !== orgId) {
      throw new NotFoundException("Dispute not found.");
    }
    return dispute;
  }

  @Post()
  @Roles(Role.ADMIN, Role.CLIENT_AP)
  @ApiOperation({ summary: "Raise a dispute against an invoice line" })
  create(@Body() dto: CreateDisputeDto, @Req() req: any) {
    return this.disputesService.create(dto, req.user.sub);
  }

  @Post(":id/start-review")
  @Roles(Role.ADMIN, Role.ACCOUNTS)
  @ApiOperation({ summary: "Move dispute to UNDER_REVIEW" })
  async startReview(@Param("id") id: string, @Body() dto: UpdateDisputeStatusDto, @Req() req: any) {
    await this.get(id, req);
    return this.disputesService.updateStatus(id, dto, req.user.sub);
  }

  @Post(":id/resolve")
  @Roles(Role.ADMIN, Role.ACCOUNTS)
  @ApiOperation({ summary: "Resolve dispute (UNDER_REVIEW → RESOLVED)" })
  async resolve(@Param("id") id: string, @Body() dto: ResolveDisputeDto, @Req() req: any) {
    await this.get(id, req);
    return this.disputesService.resolve(id, dto, req.user.sub);
  }

  @Get(":id/messages")
  @Roles(Role.ADMIN, Role.ACCOUNTS, Role.CLIENT_AP, Role.AUDITOR)
  @ApiOperation({ summary: "List messages for a dispute" })
  async listMessages(@Param("id") id: string, @Req() req?: any) {
    await this.get(id, req);
    return this.disputesService.listMessages(id);
  }

  @Post(":id/messages")
  @Roles(Role.ADMIN, Role.ACCOUNTS, Role.CLIENT_AP)
  @ApiOperation({ summary: "Post a message to a dispute thread" })
  async postMessage(@Param("id") id: string, @Body() dto: PostMessageDto, @Req() req: any) {
    await this.get(id, req);
    return this.disputesService.postMessage(id, dto, req.user.sub);
  }
}
