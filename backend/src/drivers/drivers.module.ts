import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { RolesGuard } from "../common/guards/roles.guard";
import { DriversController } from "./drivers.controller";
import { DriversService } from "./drivers.service";

@Module({
  imports: [AuthModule],
  controllers: [DriversController],
  providers: [DriversService, RolesGuard],
  exports: [DriversService],
})
export class DriversModule {}
