import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { RolesGuard } from "../common/guards/roles.guard";
import { RateCardsController } from "./rate-cards.controller";
import { RateCardsService } from "./rate-cards.service";

@Module({
  imports: [AuthModule],
  controllers: [RateCardsController],
  providers: [RateCardsService, RolesGuard],
  exports: [RateCardsService],
})
export class RateCardsModule {}
