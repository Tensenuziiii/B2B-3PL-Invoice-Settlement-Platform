import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ClientsModule } from './clients/clients.module';
import { TripsModule } from './trips/trips.module';
import { DriversModule } from './drivers/drivers.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { VendorsModule } from './vendors/vendors.module';
import { RoutesModule } from './routes/routes.module';
import { RateCardsModule } from './rate-cards/rate-cards.module';
import { StorageModule } from './storage/storage.module';
import { PodsModule } from './pods/pods.module';
import { AuditsModule } from './audits/audits.module';
import { BillingModule } from './billing/billing.module';
import { InvoicesModule } from './invoices/invoices.module';

import { APP_INTERCEPTOR } from '@nestjs/core';
import { TenantInterceptor } from './core/tenant/tenant.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string()
          .uri({ scheme: ['postgres', 'postgresql'] })
          .required(),
        JWT_SECRET: Joi.string().min(32).required(),
        PORT: Joi.number().port().default(3001),
        FRONTEND_ORIGIN: Joi.string().default('http://localhost:3000'),
        NODE_ENV: Joi.string()
          .valid('development', 'test', 'production')
          .default('development'),
      }),
    }),
    PrismaModule,
    AuthModule,
    ClientsModule,
    TripsModule,
    DriversModule,
    UsersModule,
    VehiclesModule,
    VendorsModule,
    RoutesModule,
    RateCardsModule,
    StorageModule,
    PodsModule,
    AuditsModule,
    BillingModule,
    InvoicesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_INTERCEPTOR, useClass: TenantInterceptor },
  ],
})
export class AppModule {}
