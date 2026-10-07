import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { RolesGuard } from "../common/guards/roles.guard";
import { VendorsController } from "./vendors.controller";
import { VendorsService } from "./vendors.service";

@Module({
  imports: [AuthModule],
  controllers: [VendorsController],
  providers: [VendorsService, RolesGuard],
  exports: [VendorsService],
})
export class VendorsModule {}
