import { Module } from "@nestjs/common";
import { DisputesService } from "./disputes.service";
import { DisputeNumberService } from "./dispute-number.service";

@Module({
  providers: [DisputesService, DisputeNumberService],
  exports: [DisputesService],
})
export class DisputesModule {}
