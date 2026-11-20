import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { OwnersController } from "./owners.controller";
import { OwnersService } from "./owners.service";

@Module({
  imports: [PrismaModule],
  controllers: [OwnersController],
  providers: [OwnersService],
  exports: [OwnersService],
})
export class OwnersModule {}
