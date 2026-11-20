import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { RolesGuard } from "../common/guards/roles.guard";
import { RoutesController } from "./routes.controller";
import { RoutesService } from "./routes.service";

@Module({
  imports: [AuthModule],
  controllers: [RoutesController],
  providers: [RoutesService, RolesGuard],
  exports: [RoutesService],
})
export class RoutesModule {}
