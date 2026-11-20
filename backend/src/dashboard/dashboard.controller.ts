import { Controller, Get, UseGuards } from "@nestjs/common";
import { Role } from "@prisma/client";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { DashboardService } from "./dashboard.service";

@ApiTags("dashboard")
@ApiBearerAuth()
@Controller("dashboard")
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get("summary")
  @Roles(Role.ADMIN, Role.DISPATCH_MANAGER, Role.ACCOUNTS, Role.AUDITOR, Role.STAFF, Role.VIEWER)
  @ApiOperation({ summary: "Get operational dashboard summary answering the 5 core R1 questions" })
  getOperationalSummary() {
    return this.dashboardService.getOperationalSummary();
  }
}
