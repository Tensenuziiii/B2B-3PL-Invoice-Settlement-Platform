import { Module } from "@nestjs/common";
import { PodsController } from "./pods.controller";
import { PodsService } from "./pods.service";
import { PodControlService } from "./pod-control.service";

@Module({
  controllers: [PodsController],
  providers: [PodsService, PodControlService],
  exports: [PodsService, PodControlService],
})
export class PodsModule {}
