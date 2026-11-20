import { Global, Module } from "@nestjs/common";
import { PrismaRootService, PrismaService } from "./prisma.service";

@Global()
@Module({
  providers: [PrismaService, PrismaRootService],
  exports: [PrismaService, PrismaRootService],
})
export class PrismaModule {}
