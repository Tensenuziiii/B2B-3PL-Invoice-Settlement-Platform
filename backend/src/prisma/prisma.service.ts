import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient, Prisma } from "@prisma/client";
import { tenantExtension } from "../core/tenant/tenant.extension";

function createExtendedClient() {
  return new PrismaClient().$extends(tenantExtension);
}
export type ExtendedPrismaClient = ReturnType<typeof createExtendedClient>;

// Raw, unscoped client — used ONLY by auth (login/refresh run before org is known)
@Injectable()
export class PrismaRootService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit()    { await this.$connect(); }
  async onModuleDestroy() { await this.$disconnect(); }
}

// Scoped client — used by every business module
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly c: ExtendedPrismaClient;

  constructor() {
    this.c = createExtendedClient();
  }

  get organization()      { return this.c.organization; }
  get user()              { return this.c.user; }
  get refreshToken()      { return this.c.refreshToken; }
  get passwordResetToken() { return this.c.passwordResetToken; }
  get loginAttempt()      { return this.c.loginAttempt; }
  get invitation()        { return this.c.invitation; }
  get counter()           { return this.c.counter; }
  get auditLog()          { return this.c.auditLog; }
  get notification()      { return this.c.notification; }
  get client()            { return this.c.client; }
  get vehicle()           { return this.c.vehicle; }
  get driver()            { return this.c.driver; }
  get trip()              { return this.c.trip; }
  get tripStop()          { return this.c.tripStop; }
  get pod()               { return this.c.pod; }
  get tripExpense()       { return this.c.tripExpense; }
  get eodTally()          { return this.c.eodTally; }
  get auditReview()       { return this.c.auditReview; }
  get invoice()           { return this.c.invoice; }
  get invoiceLine()       { return this.c.invoiceLine; }
  get payment()           { return this.c.payment; }
  get idempotencyKey()    { return this.c.idempotencyKey; }
  get driverAdvance()     { return (this.c as any).driverAdvance; }
  get hub()               { return (this.c as any).hub; }
  get systemAlert()       { return (this.c as any).systemAlert; }

  get $queryRaw()      { return this.c.$queryRaw.bind(this.c); }
  get $queryRawUnsafe(){ return this.c.$queryRawUnsafe.bind(this.c); }
  get $executeRaw()    { return this.c.$executeRaw.bind(this.c); }
  get $executeRawUnsafe(){ return this.c.$executeRawUnsafe.bind(this.c); }

  $transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T>;
  $transaction<T extends Prisma.PrismaPromise<any>[]>(
    queries: [...T],
  ): Promise<{ [K in keyof T]: Awaited<T[K]> }>;
  $transaction(input: any): any {
    return (this.c as any).$transaction(input);
  }

  async onModuleInit()    { await this.c.$connect(); }
  async onModuleDestroy() { await this.c.$disconnect(); }
}
