import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { Role } from "@prisma/client";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { ListAuditsQueryDto } from "./dto/list-audits-query.dto";
import { AuditsService } from "./audits.service";

@ApiTags("audits")
@ApiBearerAuth()
@Controller("audits")
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditsController {
  constructor(private readonly auditsService: AuditsService) {}

  @Get("queue")
  @Roles(Role.ADMIN, Role.AUDITOR, Role.DISPATCH_MANAGER)
  @ApiOperation({ summary: "List trips pending audit" })
  queue(@Query() query: ListAuditsQueryDto) {
    return this.auditsService.queue(query);
  }

  @Get(":tripId")
  @Roles(Role.ADMIN, Role.AUDITOR, Role.DISPATCH_MANAGER, Role.ACCOUNTS)
  @ApiOperation({ summary: "Detailed audit view for a trip" })
  detail(@Param("tripId") tripId: string) {
    return this.auditsService.detail(tripId);
  }
}
