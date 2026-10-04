import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RolesGuard } from '../common/guards/roles.guard';
import { DispatchController } from './dispatch.controller';
import { DispatchService } from './dispatch.service';

@Module({
  imports: [AuthModule],
  controllers: [DispatchController],
  providers: [DispatchService, RolesGuard],
})
export class DispatchModule {}
