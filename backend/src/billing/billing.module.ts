import { Module } from "@nestjs/common";
import { BillingService } from "./billing.service";
import { InvoiceNumberService } from "./invoice-number.service";
import { RateCardsModule } from "../rate-cards/rate-cards.module";

@Module({
  imports: [RateCardsModule],
  providers: [BillingService, InvoiceNumberService],
  exports: [BillingService, InvoiceNumberService],
})
export class BillingModule {}
