import { Test } from "@nestjs/testing";
import { HttpStatus, INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaRootService } from "../src/prisma/prisma.service";
import { AllExceptionsFilter } from "../src/common/filters/http-exception.filter";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { tenantStorage } from "../src/core/tenant/tenant.context";

describe("Invoices (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaRootService;
  let jwt: JwtService;

  let orgA: { id: string; token: string; userId: string };
  let orgB: { id: string; token: string; userId: string };

  let clientA1Id: string;
  let clientA2Id: string;
  let clientBId: string;

  let tripA1_1Id: string;
  let tripA1_2Id: string;
  let tripA1_3Id: string;
  let tripA1_NotReadyId: string;
  let tripA2Id: string;
  let tripBId: string;

  let invoiceId: string;
  let orgBInvoiceId: string;

  async function cleanup() {
    if (!prisma) return;
    const orgs = await prisma.organization.findMany({
      where: { name: { startsWith: "E2E-INV-" } },
      select: { id: true },
    });
    const orgIds = orgs.map((o) => o.id);
    if (orgIds.length > 0) {
      await prisma.invoiceLine.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.payment.deleteMany({ where: { organizationId: { in: orgIds } } });
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
        errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
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

    // 1. Seed Org A
    const a = await prisma.organization.create({
      data: {
        name: "E2E-INV-OrgA",
        users: {
          create: {
            email: "admin-a@e2e-inv.test",
            name: "Admin A",
            initials: "AA",
            displayId: "IA-01",
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
        displayId: "IA-01",
        hubName: null,
        orgId: a.id,
        permissions: ["invoices:manage"],
      }),
    };

    // 2. Seed Org B
    const b = await prisma.organization.create({
      data: {
        name: "E2E-INV-OrgB",
        users: {
          create: {
            email: "admin-b@e2e-inv.test",
            name: "Admin B",
            initials: "AB",
            displayId: "IB-01",
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
        displayId: "IB-01",
        hubName: null,
        orgId: b.id,
        permissions: ["invoices:manage"],
      }),
    };

    // 3. Seed Clients for Org A
    const clientA1 = await prisma.client.create({
      data: {
        organizationId: orgA.id,
        name: "Client A1",
        code: "CLI-INV-A1",
        status: "ACTIVE",
      },
    });
    clientA1Id = clientA1.id;

    const clientA2 = await prisma.client.create({
      data: {
        organizationId: orgA.id,
        name: "Client A2",
        code: "CLI-INV-A2",
        status: "ACTIVE",
      },
    });
    clientA2Id = clientA2.id;

    // 4. Seed Rate Cards for Org A
    await prisma.rateCard.create({
      data: {
        organizationId: orgA.id,
        name: "RC-A1",
        counterpartyType: "CLIENT",
        clientId: clientA1.id,
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

    await prisma.rateCard.create({
      data: {
        organizationId: orgA.id,
        name: "RC-A2",
        counterpartyType: "CLIENT",
        clientId: clientA2.id,
        validFrom: new Date("2026-01-01T00:00:00.000Z"),
        status: "ACTIVE",
        items: {
          create: [
            {
              organizationId: orgA.id,
              rateType: "FIXED_TRIP",
              rate: 60000,
            },
          ],
        },
      },
    });

    // 5. Seed Trips for Org A
    const tA1_1 = await prisma.trip.create({
      data: {
        organizationId: orgA.id,
        tripNumber: "TRP-202610-8101",
        status: "READY_FOR_BILLING",
        clientId: clientA1.id,
        odometerStart: 100,
        odometerEnd: 200,
      },
    });
    tripA1_1Id = tA1_1.id;

    const tA1_2 = await prisma.trip.create({
      data: {
        organizationId: orgA.id,
        tripNumber: "TRP-202610-8102",
        status: "READY_FOR_BILLING",
        clientId: clientA1.id,
        odometerStart: 200,
        odometerEnd: 300,
      },
    });
    tripA1_2Id = tA1_2.id;

    const tA1_3 = await prisma.trip.create({
      data: {
        organizationId: orgA.id,
        tripNumber: "TRP-202610-8103",
        status: "READY_FOR_BILLING",
        clientId: clientA1.id,
        odometerStart: 300,
        odometerEnd: 400,
      },
    });
    tripA1_3Id = tA1_3.id;

    const tA1_NotReady = await prisma.trip.create({
      data: {
        organizationId: orgA.id,
        tripNumber: "TRP-202610-8104",
        status: "DELIVERED",
        clientId: clientA1.id,
        odometerStart: 400,
        odometerEnd: 500,
      },
    });
    tripA1_NotReadyId = tA1_NotReady.id;

    const tA2 = await prisma.trip.create({
      data: {
        organizationId: orgA.id,
        tripNumber: "TRP-202610-8201",
        status: "READY_FOR_BILLING",
        clientId: clientA2.id,
        odometerStart: 500,
        odometerEnd: 600,
      },
    });
    tripA2Id = tA2.id;

    // 6. Seed Client & Trip & Invoice for Org B
    const clientB = await prisma.client.create({
      data: {
        organizationId: orgB.id,
        name: "Client B",
        code: "CLI-INV-B1",
        status: "ACTIVE",
      },
    });
    clientBId = clientB.id;

    await prisma.rateCard.create({
      data: {
        organizationId: orgB.id,
        name: "RC-B1",
        counterpartyType: "CLIENT",
        clientId: clientB.id,
        validFrom: new Date("2026-01-01T00:00:00.000Z"),
        status: "ACTIVE",
        items: {
          create: [
            {
              organizationId: orgB.id,
              rateType: "FIXED_TRIP",
              rate: 70000,
            },
          ],
        },
      },
    });

    const tB = await prisma.trip.create({
      data: {
        organizationId: orgB.id,
        tripNumber: "TRP-202610-8301",
        status: "READY_FOR_BILLING",
        clientId: clientB.id,
        odometerStart: 100,
        odometerEnd: 200,
      },
    });
    tripBId = tB.id;

    const invB = await prisma.invoice.create({
      data: {
        organizationId: orgB.id,
        invoiceNumber: "INV-202610-9999",
        status: "DRAFT",
        clientId: clientB.id,
        subtotal: 70000,
        gstRate: 18,
        gstAmount: 12600,
        total: 82600,
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

  it("1. POST /invoices creates a DRAFT invoice from READY_FOR_BILLING trips → 201, invoiceNumber matches /^INV-\\d{6}-\\d{4}$/, status=DRAFT", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/invoices")
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({
        clientId: clientA1Id,
        tripIds: [tripA1_1Id, tripA1_2Id],
        periodStart: "2026-10-01T00:00:00.000Z",
        periodEnd: "2026-10-10T23:59:59.000Z",
      })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.invoiceNumber).toMatch(/^INV-\d{6}-\d{4}$/);
    expect(res.body.status).toBe("DRAFT");
    invoiceId = res.body.id;
  }, 30000);

  it("2. POST /invoices with a non-READY_FOR_BILLING trip → 400", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/invoices")
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({
        clientId: clientA1Id,
        tripIds: [tripA1_NotReadyId],
        periodStart: "2026-10-01T00:00:00.000Z",
        periodEnd: "2026-10-10T23:59:59.000Z",
      })
      .expect(400);
  }, 30000);

  it("3. POST /invoices with trips from different clients → 400", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/invoices")
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({
        clientId: clientA1Id,
        tripIds: [tripA1_3Id, tripA2Id],
        periodStart: "2026-10-01T00:00:00.000Z",
        periodEnd: "2026-10-10T23:59:59.000Z",
      })
      .expect(400);
  }, 30000);

  it("4. GET /invoices returns only Org A's invoices", async () => {
    const resA = await request(app.getHttpServer())
      .get("/api/v1/invoices")
      .set("Authorization", `Bearer ${orgA.token}`)
      .expect(200);

    expect(resA.body.data).toBeInstanceOf(Array);
    expect(resA.body.data.some((inv: any) => inv.id === invoiceId)).toBe(true);
    expect(resA.body.data.every((inv: any) => inv.id !== orgBInvoiceId)).toBe(true);

    const resB = await request(app.getHttpServer())
      .get("/api/v1/invoices")
      .set("Authorization", `Bearer ${orgB.token}`)
      .expect(200);

    expect(resB.body.data).toBeInstanceOf(Array);
    expect(resB.body.data.every((inv: any) => inv.id !== invoiceId)).toBe(true);
    expect(resB.body.data.some((inv: any) => inv.id === orgBInvoiceId)).toBe(true);
  }, 30000);

  it("5. GET /invoices/:id cross-tenant → 404", async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/invoices/${invoiceId}`)
      .set("Authorization", `Bearer ${orgB.token}`)
      .expect(404);
  }, 30000);

  it("6. POST /invoices/:id/submit DRAFT → SUBMITTED (200, status=SUBMITTED, version+1)", async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/invoices/${invoiceId}/submit`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({ version: 0 })
      .expect(200);

    expect(res.body.status).toBe("SUBMITTED");
    expect(res.body.version).toBe(1);
  }, 30000);

  it("7. POST /invoices/:id/submit with stale version → 409", async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/invoices/${invoiceId}/submit`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({ version: 0 })
      .expect(409);
  }, 30000);

  it("8. POST /invoices/:id/send-to-client SUBMITTED → CLIENT_REVIEW", async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/invoices/${invoiceId}/send-to-client`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({ version: 1 })
      .expect(200);

    expect(res.body.status).toBe("CLIENT_REVIEW");
    expect(res.body.version).toBe(2);
  }, 30000);

  it("9. POST /invoices/:id/approve CLIENT_REVIEW → APPROVED", async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/invoices/${invoiceId}/approve`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({ version: 2 })
      .expect(200);

    expect(res.body.status).toBe("APPROVED");
    expect(res.body.version).toBe(3);
  }, 30000);

  it("10. DELETE /invoices/:id cancels DRAFT invoice (200), then GET → 404", async () => {
    const createRes = await request(app.getHttpServer())
      .post("/api/v1/invoices")
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({
        clientId: clientA1Id,
        tripIds: [tripA1_3Id],
        periodStart: "2026-10-01T00:00:00.000Z",
        periodEnd: "2026-10-10T23:59:59.000Z",
      })
      .expect(201);

    const draftId = createRes.body.id;

    const cancelRes = await request(app.getHttpServer())
      .delete(`/api/v1/invoices/${draftId}`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({ version: 0 })
      .expect(200);

    expect(cancelRes.body.status).toBe("CANCELLED");

    await request(app.getHttpServer())
      .get(`/api/v1/invoices/${draftId}`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .expect(404);
  }, 30000);
});
