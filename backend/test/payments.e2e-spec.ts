import { Test } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaRootService } from "../src/prisma/prisma.service";
import { AllExceptionsFilter } from "../src/common/filters/http-exception.filter";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { tenantStorage } from "../src/core/tenant/tenant.context";

describe("Payments (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaRootService;
  let jwt: JwtService;

  let orgA: { id: string; userId: string; token: string };
  let orgB: { id: string; userId: string; token: string };

  let clientAId: string;
  let invoiceId: string;
  let orgBInvoiceId: string;

  async function cleanup() {
    if (!prisma) return;
    const orgs = await prisma.organization.findMany({
      where: { name: { startsWith: "E2E-PAY-" } },
      select: { id: true },
    });
    const orgIds = orgs.map((o) => o.id);
    if (orgIds.length > 0) {
      await prisma.payment.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.invoiceLine.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.invoice.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.tripStop.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.tripExpense.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.trip.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.rateCardItem.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.rateCard.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.vehicle.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.driver.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.client.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.counter.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.user.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
    }
  }

  beforeAll(async () => {
    jest.setTimeout(60000);
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use((req: any, _res: any, next: any) => {
      const authHeader = req.headers?.authorization;
      if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
        const token = authHeader.substring(7);
        try {
          const decoded: any = jwt.verify(token);
          if (decoded?.orgId && decoded?.sub) {
            tenantStorage.enterWith({
              organizationId: decoded.orgId,
              userId: decoded.sub,
            });
          }
        } catch {}
      }
      next();
    });
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());

    let retries = 3;
    while (retries > 0) {
      try {
        await app.init();
        break;
      } catch (err) {
        retries--;
        if (retries === 0) throw err;
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }

    prisma = app.get(PrismaRootService);
    jwt = app.get(JwtService);

    await cleanup();

    // 1. Seed Org A + ADMIN user
    const a = await prisma.organization.create({
      data: {
        name: "E2E-PAY-OrgA",
        users: {
          create: {
            email: "admin-a@e2e-pay.test",
            name: "Admin A",
            initials: "AA",
            displayId: "PA-01",
            role: "ADMIN",
            passwordHash: await argon2.hash("Enterprise@2026"),
          },
        },
      },
      include: { users: true },
    });
    orgA = {
      id: a.id,
      userId: a.users[0].id,
      token: jwt.sign({
        sub: a.users[0].id,
        email: a.users[0].email,
        role: "ADMIN",
        displayId: "PA-01",
        hubName: null,
        orgId: a.id,
        permissions: ["invoices:manage", "payments:manage"],
      }),
    };

    // 2. Seed Org B + ADMIN user
    const b = await prisma.organization.create({
      data: {
        name: "E2E-PAY-OrgB",
        users: {
          create: {
            email: "admin-b@e2e-pay.test",
            name: "Admin B",
            initials: "AB",
            displayId: "PB-01",
            role: "ADMIN",
            passwordHash: await argon2.hash("Enterprise@2026"),
          },
        },
      },
      include: { users: true },
    });
    orgB = {
      id: b.id,
      userId: b.users[0].id,
      token: jwt.sign({
        sub: b.users[0].id,
        email: b.users[0].email,
        role: "ADMIN",
        displayId: "PB-01",
        hubName: null,
        orgId: b.id,
        permissions: ["invoices:manage", "payments:manage"],
      }),
    };

    // 3. Seed Client, Vehicle, Driver, RateCard, Trip in Org A
    const clientA = await prisma.client.create({
      data: {
        organizationId: orgA.id,
        name: "Client Pay A",
        code: "CLI-PAY-A1",
        status: "ACTIVE",
      },
    });
    clientAId = clientA.id;

    const driverA = await prisma.driver.create({
      data: {
        organizationId: orgA.id,
        name: "Driver Pay A",
        phone: "+919876543888",
        licenseNo: "DL-PAY-2026-0001",
        active: true,
      },
    });

    const vehicleA = await prisma.vehicle.create({
      data: {
        organizationId: orgA.id,
        regNo: "DL-01-PAY-1111",
        type: "Van",
        capacityKg: 1500,
        currentOdometer: 1000,
        active: true,
      },
    });

    await prisma.rateCard.create({
      data: {
        organizationId: orgA.id,
        name: "RC-PAY-A1",
        counterpartyType: "CLIENT",
        clientId: clientA.id,
        validFrom: new Date("2026-01-01T00:00:00.000Z"),
        status: "ACTIVE",
        items: {
          create: [
            {
              organizationId: orgA.id,
              rateType: "FIXED_TRIP",
              rate: 50000,
            },
          ],
        },
      },
    });

    const trip1 = await prisma.trip.create({
      data: {
        organizationId: orgA.id,
        tripNumber: "TRP-202610-9801",
        status: "READY_FOR_BILLING",
        clientId: clientA.id,
        driverId: driverA.id,
        vehicleId: vehicleA.id,
        odometerStart: 100,
        odometerEnd: 200,
      },
    });

    // 4. Generate invoice → submit → send-to-client → approve (moves to APPROVED)
    const invRes = await request(app.getHttpServer())
      .post("/api/v1/invoices")
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({
        clientId: clientAId,
        tripIds: [trip1.id],
        periodStart: "2026-10-01T00:00:00.000Z",
        periodEnd: "2026-10-10T23:59:59.000Z",
      })
      .expect(201);

    invoiceId = invRes.body.id;

    await request(app.getHttpServer())
      .post(`/api/v1/invoices/${invoiceId}/submit`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({ version: 0 })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/invoices/${invoiceId}/send-to-client`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({ version: 1 })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/invoices/${invoiceId}/approve`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({ version: 2 })
      .expect(200);

    // 5. Seed an invoice in Org B
    const clientB = await prisma.client.create({
      data: {
        organizationId: orgB.id,
        name: "Client Pay B",
        code: "CLI-PAY-B1",
        status: "ACTIVE",
      },
    });

    const invB = await prisma.invoice.create({
      data: {
        organizationId: orgB.id,
        invoiceNumber: "INV-202610-9899",
        status: "APPROVED",
        clientId: clientB.id,
        subtotal: 50000,
        gstRate: 18,
        gstAmount: 9000,
        total: 59000,
      },
    });
    orgBInvoiceId = invB.id;
  }, 60000);

  afterAll(async () => {
    await cleanup();
    if (app) {
      await app.close();
    }
  }, 60000);

  it("1. POST /invoices/:id/payments as Org A records a partial payment → 200, invoice status becomes PAYMENT_QUEUED", async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/invoices/${invoiceId}/payments`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({
        amount: 20000,
        method: "UPI",
        reference: "UPI-PAY-001",
      })
      .expect(200);

    expect(res.body.payment).toBeDefined();
    expect(res.body.payment.id).toBeDefined();
    expect(res.body.payment.amount).toBe(20000);
    expect(res.body.invoiceStatus).toBe("PAYMENT_QUEUED");
    expect(res.body.totalPaidPaise).toBe(20000);
    expect(res.body.remainingPaise).toBe(39000);

    const updated = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    expect(updated?.status).toBe("PAYMENT_QUEUED");
  }, 30000);

  it("2. POST /invoices/:id/payments records second payment completing the invoice → status PAID", async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/invoices/${invoiceId}/payments`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({
        amount: 39000,
        method: "BANK_TRANSFER",
        reference: "NEFT-PAY-002",
      })
      .expect(200);

    expect(res.body.invoiceStatus).toBe("PAID");
    expect(res.body.totalPaidPaise).toBe(59000);
    expect(res.body.remainingPaise).toBe(0);

    const updated = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    expect(updated?.status).toBe("PAID");
  }, 30000);

  it("3. POST /invoices/:id/payments with amount=0 → 400", async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/invoices/${invoiceId}/payments`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({
        amount: 0,
        method: "CASH",
      })
      .expect(400);
  }, 30000);

  it("4. POST /invoices/:id/payments on Org B's invoice (as Org A) → 404", async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/invoices/${orgBInvoiceId}/payments`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({
        amount: 10000,
        method: "CASH",
      })
      .expect(404);
  }, 30000);

  it("5. GET /invoices/:id/payments returns list of payments", async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/invoices/${invoiceId}/payments`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .expect(200);

    expect(res.body).toBeInstanceOf(Array);
    expect(res.body.length).toBe(2);
    expect(res.body.every((p: any) => p.invoiceId === invoiceId)).toBe(true);
  }, 30000);

  it("6. POST /invoices/:id/mark-paid transitions APPROVED → PAID (use a fresh invoice)", async () => {
    const freshInv = await prisma.invoice.create({
      data: {
        organizationId: orgA.id,
        invoiceNumber: "INV-202610-8888",
        status: "APPROVED",
        clientId: clientAId,
        subtotal: 50000,
        gstRate: 18,
        gstAmount: 9000,
        total: 59000,
      },
    });

    const res = await request(app.getHttpServer())
      .post(`/api/v1/invoices/${freshInv.id}/mark-paid`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .expect(200);

    expect(res.body.status).toBe("PAID");

    const updated = await prisma.invoice.findUnique({ where: { id: freshInv.id } });
    expect(updated?.status).toBe("PAID");
  }, 30000);
});
