import { Module } from "@nestjs/common";
import { InvoicesController } from "./invoices.controller";
import { InvoicesService } from "./invoices.service";
import { BillingModule } from "../billing/billing.module";
import { PaymentsModule } from "../payments/payments.module";

@Module({
  imports: [BillingModule, PaymentsModule],
  controllers: [InvoicesController],
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
