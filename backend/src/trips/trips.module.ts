import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { TripsController } from "./trips.controller";
import { TripsService } from "./trips.service";
import { TripNumberService } from "./trip-number.service";
import { AssignmentGuardService } from "./assignment-guard.service";
import { PodsModule } from "../pods/pods.module";

@Module({
  imports: [AuthModule, PodsModule],
  controllers: [TripsController],
  providers: [TripsService, TripNumberService, AssignmentGuardService],
  exports: [TripsService, TripNumberService, AssignmentGuardService],
})
export class TripsModule {}
