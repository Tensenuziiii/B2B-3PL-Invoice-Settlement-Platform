import { Module } from "@nestjs/common";
import { VendorSettlementsController } from "./vendor-settlements.controller";
import { VendorSettlementsService } from "./vendor-settlements.service";
import { SettlementNumberService } from "./settlement-number.service";
import { RateCardsModule } from "../rate-cards/rate-cards.module";

@Module({
  imports: [RateCardsModule],
  controllers: [VendorSettlementsController],
  providers: [VendorSettlementsService, SettlementNumberService],
  exports: [VendorSettlementsService],
})
export class VendorSettlementsModule {}
