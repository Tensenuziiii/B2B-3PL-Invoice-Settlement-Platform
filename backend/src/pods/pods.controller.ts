import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { Role } from "@prisma/client";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { PresignUploadDto } from "./dto/presign-upload.dto";
import { ConfirmUploadDto } from "./dto/confirm-upload.dto";
import { PodsService } from "./pods.service";

@ApiTags("pods")
@ApiBearerAuth()
@Controller("pods")
@UseGuards(JwtAuthGuard, RolesGuard)
export class PodsController {
  constructor(private readonly podsService: PodsService) {}

  @Post("presign-upload")
  @Roles(Role.ADMIN, Role.DISPATCH_MANAGER, Role.DRIVER, Role.AUDITOR)
  @ApiOperation({ summary: "Get a presigned URL for POD upload" })
  presign(@Body() dto: PresignUploadDto) {
    return this.podsService.presignUpload(dto);
  }

  @Post()
  @Roles(Role.ADMIN, Role.DISPATCH_MANAGER, Role.DRIVER, Role.AUDITOR)
  @ApiOperation({ summary: "Confirm POD upload and create metadata row" })
  confirm(@Body() dto: ConfirmUploadDto, @Req() req: any) {
    return this.podsService.confirmUpload(dto, req.user.sub);
  }

  @Get("stops/:tripStopId")
  @Roles(Role.ADMIN, Role.DISPATCH_MANAGER, Role.AUDITOR, Role.ACCOUNTS, Role.CLIENT_AP)
  @ApiOperation({ summary: "List POD documents for a trip stop" })
  listForStop(@Param("tripStopId") tripStopId: string) {
    return this.podsService.listForStop(tripStopId);
  }

  @Get(":id/download-url")
  @Roles(Role.ADMIN, Role.DISPATCH_MANAGER, Role.AUDITOR, Role.ACCOUNTS, Role.CLIENT_AP)
  @ApiOperation({ summary: "Get a presigned download URL for a POD document" })
  downloadUrl(@Param("id") id: string) {
    return this.podsService.downloadUrl(id);
  }
}
