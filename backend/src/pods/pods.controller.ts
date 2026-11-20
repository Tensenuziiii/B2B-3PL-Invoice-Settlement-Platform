import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { Role } from "@prisma/client";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { PresignUploadDto } from "./dto/presign-upload.dto";
import { ConfirmUploadDto } from "./dto/confirm-upload.dto";
import { SubmitChecklistDto } from "./dto/pod-checklist.dto";
import { PodHoldDto, PodReleaseHoldDto } from "./dto/pod-hold.dto";
import { PodCourierDto, PodMarkLostDto, PodDuplicateRequestDto } from "./dto/pod-physical.dto";
import { PodsService } from "./pods.service";
import { PodControlService } from "./pod-control.service";

@ApiTags("pods")
@ApiBearerAuth()
@Controller("pods")
@UseGuards(JwtAuthGuard, RolesGuard)
export class PodsController {
  constructor(
    private readonly podsService: PodsService,
    private readonly podControl: PodControlService,
  ) {}

  @Post("presign-upload")
  @Roles(Role.ADMIN, Role.DISPATCH_MANAGER, Role.DRIVER, Role.AUDITOR, Role.STAFF)
  @ApiOperation({ summary: "Get a presigned URL for POD upload" })
  presign(@Body() dto: PresignUploadDto) {
    return this.podsService.presignUpload(dto);
  }

  @Post()
  @Roles(Role.ADMIN, Role.DISPATCH_MANAGER, Role.DRIVER, Role.AUDITOR, Role.STAFF)
  @ApiOperation({ summary: "Confirm POD upload and create metadata row" })
  confirm(@Body() dto: ConfirmUploadDto, @Req() req: any) {
    return this.podsService.confirmUpload(dto, req.user.sub);
  }

  @Get("stops/:tripStopId")
  @Roles(Role.ADMIN, Role.DISPATCH_MANAGER, Role.AUDITOR, Role.ACCOUNTS, Role.STAFF, Role.VIEWER, Role.CLIENT_AP)
  @ApiOperation({ summary: "List POD documents for a trip stop" })
  listForStop(@Param("tripStopId") tripStopId: string) {
    return this.podsService.listForStop(tripStopId);
  }

  @Get(":id/download-url")
  @Roles(Role.ADMIN, Role.DISPATCH_MANAGER, Role.AUDITOR, Role.ACCOUNTS, Role.STAFF, Role.VIEWER, Role.CLIENT_AP)
  @ApiOperation({ summary: "Get a presigned download URL for a POD document" })
  downloadUrl(@Param("id") id: string) {
    return this.podsService.downloadUrl(id);
  }

  // ─── R1 POD Control Engine ────────────────────────────────────────────────────

  @Get("by-trip/:tripId")
  @Roles(Role.ADMIN, Role.DISPATCH_MANAGER, Role.ACCOUNTS, Role.AUDITOR, Role.STAFF, Role.VIEWER)
  @ApiOperation({ summary: "Get POD record for a trip" })
  getByTrip(@Param("tripId") tripId: string) {
    return this.podControl.getByTripId(tripId);
  }

  @Get("control/:id")
  @Roles(Role.ADMIN, Role.DISPATCH_MANAGER, Role.ACCOUNTS, Role.AUDITOR, Role.STAFF, Role.VIEWER)
  @ApiOperation({ summary: "Get POD by id (with checklist and events)" })
  getPod(@Param("id") id: string) {
    return this.podControl.getById(id);
  }

  @Post("control/:id/soft-copy-received")
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN, Role.DISPATCH_MANAGER, Role.STAFF)
  @ApiOperation({ summary: "Mark soft copy received (PENDING_DELIVERY → SOFT_COPY_RECEIVED)" })
  markSoftCopyReceived(@Param("id") id: string, @Req() req: any) {
    return this.podControl.markSoftCopyReceived(id, req.user.sub);
  }

  @Post("control/:id/checklist")
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN, Role.DISPATCH_MANAGER, Role.STAFF, Role.AUDITOR)
  @ApiOperation({ summary: "Submit checklist for POD (transitions to SOFT_COPY_CHECKED or ON_HOLD)" })
  submitChecklist(@Param("id") id: string, @Body() dto: SubmitChecklistDto, @Req() req: any) {
    return this.podControl.submitChecklist(id, dto, req.user.sub);
  }

  @Post("control/:id/hold")
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN, Role.DISPATCH_MANAGER, Role.STAFF)
  @ApiOperation({ summary: "Place POD on hold with reason and remarks" })
  placeOnHold(@Param("id") id: string, @Body() dto: PodHoldDto, @Req() req: any) {
    return this.podControl.placeOnHold(id, dto, req.user.sub);
  }

  @Post("control/:id/release-hold")
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN, Role.DISPATCH_MANAGER, Role.STAFF)
  @ApiOperation({ summary: "Release POD hold (ON_HOLD → SOFT_COPY_RECEIVED)" })
  releaseHold(@Param("id") id: string, @Body() dto: PodReleaseHoldDto, @Req() req: any) {
    return this.podControl.releaseHold(id, dto, req.user.sub);
  }

  // ─── Physical POD Tracking (R1-TASK-5.2) ────────────────────────────────────

  @Post("control/:id/dispatch-courier")
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN, Role.DISPATCH_MANAGER, Role.STAFF)
  @ApiOperation({ summary: "Dispatch original POD via courier (SOFT_COPY_CHECKED → ORIGINAL_DISPATCHED)" })
  dispatchCourier(@Param("id") id: string, @Body() dto: PodCourierDto, @Req() req: any) {
    return this.podControl.dispatchCourier(id, dto, req.user.sub);
  }

  @Post("control/:id/mark-received")
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN, Role.DISPATCH_MANAGER, Role.STAFF)
  @ApiOperation({ summary: "Mark original POD received in office (ORIGINAL_DISPATCHED → ORIGINAL_RECEIVED)" })
  markOriginalReceived(@Param("id") id: string, @Req() req: any) {
    return this.podControl.markOriginalReceived(id, req.user.sub);
  }

  @Post("control/:id/mark-lost")
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN, Role.DISPATCH_MANAGER, Role.STAFF)
  @ApiOperation({ summary: "Mark original POD as lost" })
  markLost(@Param("id") id: string, @Body() dto: PodMarkLostDto, @Req() req: any) {
    return this.podControl.markLost(id, dto, req.user.sub);
  }

  @Post("control/:id/request-duplicate")
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN, Role.DISPATCH_MANAGER, Role.STAFF)
  @ApiOperation({ summary: "Request duplicate POD from customer (LOST → DUPLICATE_REQUESTED)" })
  requestDuplicate(@Param("id") id: string, @Body() dto: PodDuplicateRequestDto, @Req() req: any) {
    return this.podControl.requestDuplicate(id, dto, req.user.sub);
  }

  @Post("control/:id/submit-to-client")
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN, Role.DISPATCH_MANAGER, Role.STAFF, Role.ACCOUNTS)
  @ApiOperation({ summary: "Submit original POD to client (ORIGINAL_RECEIVED → SUBMITTED_TO_CLIENT)" })
  submitToClient(@Param("id") id: string, @Req() req: any) {
    return this.podControl.submitToClient(id, req.user.sub);
  }

  @Post("control/:id/acknowledge")
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN, Role.ACCOUNTS, Role.STAFF)
  @ApiOperation({ summary: "Client acknowledges POD receipt (SUBMITTED_TO_CLIENT → ACKNOWLEDGED)" })
  acknowledgeReceipt(@Param("id") id: string, @Req() req: any) {
    return this.podControl.acknowledgeReceipt(id, req.user.sub);
  }
}
