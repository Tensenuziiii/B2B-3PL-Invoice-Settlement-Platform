import { Test } from "@nestjs/testing";
import { HttpStatus, INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaRootService } from "../src/prisma/prisma.service";
import { AllExceptionsFilter } from "../src/common/filters/http-exception.filter";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { tenantStorage } from "../src/core/tenant/tenant.context";

describe("Disputes (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaRootService;
  let jwt: JwtService;

  let orgA: { id: string; userId: string };
  let orgB: { id: string; userId: string };

  let adminTokenA: string;
  let clientTokenA: string;
  let accountsTokenA: string;
  let adminTokenB: string;

  let clientAId: string;
  let invoiceId: string;
  let line1Id: string;
  let line2Id: string;
  let line2Total: number;
  let disputeId: string;

  async function cleanup() {
    if (!prisma) return;
    const orgs = await prisma.organization.findMany({
      where: { name: { startsWith: "E2E-DSP-" } },
      select: { id: true },
    });
    const orgIds = orgs.map((o) => o.id);
    if (orgIds.length > 0) {
      await prisma.message.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.dispute.deleteMany({ where: { organizationId: { in: orgIds } } });
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

    // 1. Seed Org A with ADMIN
    const a = await prisma.organization.create({
      data: {
        name: "E2E-DSP-OrgA",
        users: {
          create: {
            email: "admin-a@e2e-dsp.test",
            name: "Admin A",
            initials: "AA",
            displayId: "DA-01",
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
    };
    adminTokenA = jwt.sign({
      sub: a.users[0].id,
      email: a.users[0].email,
      role: "ADMIN",
      displayId: "DA-01",
      hubName: null,
      orgId: a.id,
      permissions: ["invoices:manage", "disputes:manage"],
    });

    // 2. Seed Org B with ADMIN
    const b = await prisma.organization.create({
      data: {
        name: "E2E-DSP-OrgB",
        users: {
          create: {
            email: "admin-b@e2e-dsp.test",
            name: "Admin B",
            initials: "AB",
            displayId: "DB-01",
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
    };
    adminTokenB = jwt.sign({
      sub: b.users[0].id,
      email: b.users[0].email,
      role: "ADMIN",
      displayId: "DB-01",
      hubName: null,
      orgId: b.id,
      permissions: ["invoices:manage", "disputes:manage"],
    });

    // 3. Seed Client in Org A
    const clientA = await prisma.client.create({
      data: {
        organizationId: orgA.id,
        name: "Client DSP A",
        code: "CLI-DSP-A1",
        status: "ACTIVE",
      },
    });
    clientAId = clientA.id;

    // 4. Seed CLIENT_AP User in Org A
    const clientUser = await prisma.user.create({
      data: {
        organizationId: orgA.id,
        email: "client-ap@e2e-dsp.test",
        name: "Client AP",
        initials: "CA",
        displayId: "CA-01",
        role: "CLIENT_AP",
        clientId: clientA.id,
        passwordHash: await argon2.hash("Enterprise@2026"),
      },
    });
    clientTokenA = jwt.sign({
      sub: clientUser.id,
      email: clientUser.email,
      role: "CLIENT_AP",
      displayId: "CA-01",
      hubName: null,
      orgId: orgA.id,
      permissions: ["invoices:review", "disputes:raise"],
      clientId: clientA.id,
    });

    // 5. Seed ACCOUNTS User in Org A
    const accountsUser = await prisma.user.create({
      data: {
        organizationId: orgA.id,
        email: "accounts@e2e-dsp.test",
        name: "Accounts User",
        initials: "AC",
        displayId: "AC-01",
        role: "ACCOUNTS",
        passwordHash: await argon2.hash("Enterprise@2026"),
      },
    });
    accountsTokenA = jwt.sign({
      sub: accountsUser.id,
      email: accountsUser.email,
      role: "ACCOUNTS",
      displayId: "AC-01",
      hubName: null,
      orgId: orgA.id,
      permissions: ["invoices:manage", "disputes:resolve"],
    });

    // 6. Seed Driver and Vehicle in Org A
    const driverA = await prisma.driver.create({
      data: {
        organizationId: orgA.id,
        name: "Driver DSP A",
        phone: "+919876543999",
        licenseNo: "DL-DSP-2026-0001",
        active: true,
      },
    });

    const vehicleA = await prisma.vehicle.create({
      data: {
        organizationId: orgA.id,
        regNo: "DL-01-DSP-1111",
        type: "Van",
        capacityKg: 1500,
        currentOdometer: 1000,
        active: true,
      },
    });

    // 7. Seed Rate Card in Org A
    await prisma.rateCard.create({
      data: {
        organizationId: orgA.id,
        name: "RC-DSP-A1",
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

    // 8. Seed 2 Trips in Org A
    const trip1 = await prisma.trip.create({
      data: {
        organizationId: orgA.id,
        tripNumber: "TRP-202610-9501",
        status: "READY_FOR_BILLING",
        clientId: clientA.id,
        driverId: driverA.id,
        vehicleId: vehicleA.id,
        odometerStart: 100,
        odometerEnd: 200,
      },
    });

    const trip2 = await prisma.trip.create({
      data: {
        organizationId: orgA.id,
        tripNumber: "TRP-202610-9502",
        status: "READY_FOR_BILLING",
        clientId: clientA.id,
        driverId: driverA.id,
        vehicleId: vehicleA.id,
        odometerStart: 200,
        odometerEnd: 300,
      },
    });

    // 9. Generate Invoice via API (POST /invoices as admin A) → DRAFT
    const invRes = await request(app.getHttpServer())
      .post("/api/v1/invoices")
      .set("Authorization", `Bearer ${adminTokenA}`)
      .send({
        clientId: clientAId,
        tripIds: [trip1.id, trip2.id],
        periodStart: "2026-10-01T00:00:00.000Z",
        periodEnd: "2026-10-10T23:59:59.000Z",
      })
      .expect(201);

    invoiceId = invRes.body.id;

    // 10. Submit (DRAFT → SUBMITTED)
    await request(app.getHttpServer())
      .post(`/api/v1/invoices/${invoiceId}/submit`)
      .set("Authorization", `Bearer ${adminTokenA}`)
      .send({ version: 0 })
      .expect(200);

    // 11. Send to client (SUBMITTED → CLIENT_REVIEW)
    await request(app.getHttpServer())
      .post(`/api/v1/invoices/${invoiceId}/send-to-client`)
      .set("Authorization", `Bearer ${adminTokenA}`)
      .send({ version: 1 })
      .expect(200);

    // 12. Query lines
    const fullInvoice = await prisma.invoice.findUniqueOrThrow({
      where: { id: invoiceId },
      include: { lines: true },
    });
    line1Id = fullInvoice.lines[0].id;
    line2Id = fullInvoice.lines[1].id;
    line2Total = fullInvoice.lines[1].totalAmount;
  }, 60000);

  afterAll(async () => {
    await cleanup();
    if (app) {
      await app.close();
    }
  }, 60000);

  it("1. POST /disputes as CLIENT_AP user creates dispute → 201, disputeNumber matches /^DSP-\\d{6}-\\d{4}$/, status=DISPUTED", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/disputes")
      .set("Authorization", `Bearer ${clientTokenA}`)
      .send({
        invoiceLineId: line1Id,
        reasonCode: "RATE_MISMATCH",
        comment: "Disputed trip charge due to agreed discount",
        amountPaise: 10000,
      })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.disputeNumber).toMatch(/^DSP-\d{6}-\d{4}$/);
    expect(res.body.status).toBe("DISPUTED");
    expect(res.body.amountPaise).toBe(10000);
    disputeId = res.body.id;

    const inv = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    expect(inv?.status).toBe("DISPUTED");
  }, 30000);

  it("2. POST /disputes twice on same line → 409", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/disputes")
      .set("Authorization", `Bearer ${clientTokenA}`)
      .send({
        invoiceLineId: line1Id,
        reasonCode: "DUPLICATE_CLAIM",
        comment: "Another dispute on same line",
        amountPaise: 5000,
      })
      .expect(409);
  }, 30000);

  it("3. POST /disputes with amountPaise > line total → 400", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/disputes")
      .set("Authorization", `Bearer ${clientTokenA}`)
      .send({
        invoiceLineId: line2Id,
        reasonCode: "OVERCHARGE",
        comment: "Excessive dispute amount",
        amountPaise: line2Total + 100000,
      })
      .expect(400);
  }, 30000);

  it("4. GET /disputes as Org A returns disputes (only Org A's — includes the one we created)", async () => {
    const resA = await request(app.getHttpServer())
      .get("/api/v1/disputes")
      .set("Authorization", `Bearer ${adminTokenA}`)
      .expect(200);

    expect(resA.body.data).toBeInstanceOf(Array);
    expect(resA.body.data.some((d: any) => d.id === disputeId)).toBe(true);

    const resB = await request(app.getHttpServer())
      .get("/api/v1/disputes")
      .set("Authorization", `Bearer ${adminTokenB}`)
      .expect(200);

    expect(resB.body.data).toBeInstanceOf(Array);
    expect(resB.body.data.every((d: any) => d.id !== disputeId)).toBe(true);
  }, 30000);

  it("5. GET /disputes/:id cross-tenant (Org B trying to access Org A's dispute) → 404", async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/disputes/${disputeId}`)
      .set("Authorization", `Bearer ${adminTokenB}`)
      .expect(404);
  }, 30000);

  it("6. POST /disputes/:id/start-review as ACCOUNTS → status=UNDER_REVIEW, version+1", async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/disputes/${disputeId}/start-review`)
      .set("Authorization", `Bearer ${accountsTokenA}`)
      .send({
        version: 0,
        status: "UNDER_REVIEW",
      })
      .expect(201);

    expect(res.body.status).toBe("UNDER_REVIEW");
    expect(res.body.version).toBe(1);
  }, 30000);

  it("7. POST /disputes/:id/start-review with stale version → 409", async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/disputes/${disputeId}/start-review`)
      .set("Authorization", `Bearer ${accountsTokenA}`)
      .send({
        version: 0,
        status: "UNDER_REVIEW",
      })
      .expect(409);
  }, 30000);

  it("8. POST /disputes/:id/messages as CLIENT_AP → 201, message body returned", async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/disputes/${disputeId}/messages`)
      .set("Authorization", `Bearer ${clientTokenA}`)
      .send({
        body: "Rate was agreed at Rs 400 fixed instead of Rs 500.",
      })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.body).toBe("Rate was agreed at Rs 400 fixed instead of Rs 500.");
    expect(res.body.disputeId).toBe(disputeId);
  }, 30000);

  it("9. POST /disputes/:id/messages after resolve → 400", async () => {
    const d2Res = await request(app.getHttpServer())
      .post("/api/v1/disputes")
      .set("Authorization", `Bearer ${clientTokenA}`)
      .send({
        invoiceLineId: line2Id,
        reasonCode: "DAMAGE",
        comment: "Transit damage claimed",
        amountPaise: 5000,
      })
      .expect(201);

    const dispute2Id = d2Res.body.id;

    await request(app.getHttpServer())
      .post(`/api/v1/disputes/${dispute2Id}/resolve`)
      .set("Authorization", `Bearer ${accountsTokenA}`)
      .send({
        version: 0,
        resolution: "REJECTED",
        resolutionNotes: "No damage evidence provided",
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/disputes/${dispute2Id}/messages`)
      .set("Authorization", `Bearer ${clientTokenA}`)
      .send({
        body: "Attempting to post to resolved dispute",
      })
      .expect(400);
  }, 30000);

  it("10. POST /disputes/:id/resolve with ACCEPTED → status=RESOLVED, invoice line amount adjusted", async () => {
    const beforeLine = await prisma.invoiceLine.findUniqueOrThrow({ where: { id: line1Id } });
    const beforeInvoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });

    const res = await request(app.getHttpServer())
      .post(`/api/v1/disputes/${disputeId}/resolve`)
      .set("Authorization", `Bearer ${accountsTokenA}`)
      .send({
        version: 1,
        resolution: "ACCEPTED",
        resolutionNotes: "Accepted line discount adjustment",
      })
      .expect(201);

    expect(res.body.status).toBe("RESOLVED");
    expect(res.body.resolution).toBe("ACCEPTED");
    expect(res.body.version).toBe(2);

    const afterLine = await prisma.invoiceLine.findUniqueOrThrow({ where: { id: line1Id } });
    const expectedLineAmount = Math.max(0, beforeLine.lineAmount - 10000);
    const expectedGst = Math.round(expectedLineAmount * 0.18);
    const expectedTotal = expectedLineAmount + expectedGst;

    expect(afterLine.lineAmount).toBe(expectedLineAmount);
    expect(afterLine.gstAmount).toBe(expectedGst);
    expect(afterLine.totalAmount).toBe(expectedTotal);

    const afterInvoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    expect(afterInvoice.subtotal).toBe(beforeInvoice.subtotal - 10000);
  }, 30000);
});
