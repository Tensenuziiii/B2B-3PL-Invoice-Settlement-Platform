import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { RolesGuard } from "../common/guards/roles.guard";
import { VehiclesController } from "./vehicles.controller";
import { VehiclesService } from "./vehicles.service";

@Module({
  imports: [AuthModule],
  controllers: [VehiclesController],
  providers: [VehiclesService, RolesGuard],
  exports: [VehiclesService],
})
export class VehiclesModule {}
