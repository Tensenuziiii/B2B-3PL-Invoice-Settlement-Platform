import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { RolesGuard } from "../common/guards/roles.guard";
import { ClientsController } from "./clients.controller";
import { ClientsService } from "./clients.service";

@Module({
  imports: [AuthModule],
  controllers: [ClientsController],
  providers: [ClientsService, RolesGuard],
  exports: [ClientsService],
})
export class ClientsModule {}
