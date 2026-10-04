import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RolesGuard } from '../common/guards/roles.guard';
import { DriverController } from './driver.controller';
import { DriverService } from './driver.service';

@Module({
  imports: [AuthModule],
  controllers: [DriverController],
  providers: [DriverService, RolesGuard],
})
export class DriverModule {}