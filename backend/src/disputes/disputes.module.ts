import { Module } from "@nestjs/common";
import { DisputesController } from "./disputes.controller";
import { DisputesService } from "./disputes.service";
import { DisputeNumberService } from "./dispute-number.service";

@Module({
  controllers: [DisputesController],
  providers: [DisputesService, DisputeNumberService],
  exports: [DisputesService],
})
export class DisputesModule {}
