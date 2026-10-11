import { Test } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaRootService } from "../src/prisma/prisma.service";
import { AllExceptionsFilter } from "../src/common/filters/http-exception.filter";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { tenantStorage } from "../src/core/tenant/tenant.context";

describe("VendorSettlements (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaRootService;
  let jwt: JwtService;

  let orgA: { id: string; userId: string; token: string };
  let orgB: { id: string; userId: string; token: string };

  let vendorAId: string;
  let trip1Id: string;
  let trip2Id: string;
  let trip3Id: string;
  let settlement1Id: string;

  async function cleanup() {
    if (!prisma) return;
    const orgs = await prisma.organization.findMany({
      where: { name: { startsWith: "E2E-STL-" } },
      select: { id: true },
    });
    const orgIds = orgs.map((o) => o.id);
    if (orgIds.length > 0) {
      await prisma.vendorSettlementItem.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.vendorSettlement.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.tripStop.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.tripExpense.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.trip.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.rateCardItem.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.rateCard.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.vendor.deleteMany({ where: { organizationId: { in: orgIds } } });
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
        name: "E2E-STL-OrgA",
        users: {
          create: {
            email: "admin-a@e2e-stl.test",
            name: "Admin STL A",
            initials: "SA",
            displayId: "SA-01",
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
        displayId: "SA-01",
        hubName: null,
        orgId: a.id,
        permissions: ["settlements:manage"],
      }),
    };

    // 2. Seed Org B + ADMIN user
    const b = await prisma.organization.create({
      data: {
        name: "E2E-STL-OrgB",
        users: {
          create: {
            email: "admin-b@e2e-stl.test",
            name: "Admin STL B",
            initials: "SB",
            displayId: "SB-01",
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
        displayId: "SB-01",
        hubName: null,
        orgId: b.id,
        permissions: ["settlements:manage"],
      }),
    };

    // 3. Seed Vendor + RateCard in Org A
    const vendorA = await prisma.vendor.create({
      data: {
        organizationId: orgA.id,
        name: "Vendor STL A",
        code: "VND-STL-A1",
        status: "ACTIVE",
      },
    });
    vendorAId = vendorA.id;

    await prisma.rateCard.create({
      data: {
        organizationId: orgA.id,
        name: "RC-VENDOR-STL-A",
        counterpartyType: "VENDOR",
        vendorId: vendorA.id,
        validFrom: new Date("2026-01-01T00:00:00.000Z"),
        status: "ACTIVE",
        items: {
          create: [
            {
              organizationId: orgA.id,
              rateType: "FIXED_TRIP",
              rate: 450000,
            },
          ],
        },
      },
    });

    // 4. Seed 2 trips in Org A with vendorId, READY_FOR_BILLING, odometers set
    const trip1 = await prisma.trip.create({
      data: {
        organizationId: orgA.id,
        tripNumber: "TRP-STL-0001",
        status: "READY_FOR_BILLING",
        vendorId: vendorA.id,
        odometerStart: 100,
        odometerEnd: 250,
        tripStops: {
          create: [
            {
              organizationId: orgA.id,
              sequence: 1,
              name: "Stop 1",
              status: "DELIVERED",
            },
          ],
        },
      },
    });
    trip1Id = trip1.id;

    const trip2 = await prisma.trip.create({
      data: {
        organizationId: orgA.id,
        tripNumber: "TRP-STL-0002",
        status: "READY_FOR_BILLING",
        vendorId: vendorA.id,
        odometerStart: 250,
        odometerEnd: 400,
        tripStops: {
          create: [
            {
              organizationId: orgA.id,
              sequence: 1,
              name: "Stop 1",
              status: "DELIVERED",
            },
          ],
        },
      },
    });
    trip2Id = trip2.id;

    // 5. Seed a non-READY_FOR_BILLING trip in Org A
    const trip3 = await prisma.trip.create({
      data: {
        organizationId: orgA.id,
        tripNumber: "TRP-STL-0003",
        status: "ASSIGNED",
        vendorId: vendorA.id,
        odometerStart: 400,
        odometerEnd: 550,
        tripStops: {
          create: [
            {
              organizationId: orgA.id,
              sequence: 1,
              name: "Stop 1",
              status: "PENDING",
            },
          ],
        },
      },
    });
    trip3Id = trip3.id;
  });

  afterAll(async () => {
    await cleanup();
    if (app) await app.close();
  });

  it("1. POST /vendor-settlements creates DRAFT with settlementNumber /^STL-\\d{6}-\\d{4}$/", async () => {
    const res = await request(app.getHttpServer())
      .post("/vendor-settlements")
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({
        vendorId: vendorAId,
        tripIds: [trip1Id],
        notes: "Settlement for trip 1",
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.status).toBe("DRAFT");
    expect(res.body.settlementNumber).toMatch(/^STL-\d{6}-\d{4}$/);
    expect(res.body.totalPaise).toBe(450000);

    settlement1Id = res.body.id;
  });

  it("2. POST /vendor-settlements with non-READY_FOR_BILLING trip → 400", async () => {
    const res = await request(app.getHttpServer())
      .post("/vendor-settlements")
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({
        vendorId: vendorAId,
        tripIds: [trip3Id],
      });

    expect(res.status).toBe(400);
  });

  it("3. GET /vendor-settlements returns Org A settlements only", async () => {
    // Org A request
    const resA = await request(app.getHttpServer())
      .get("/vendor-settlements")
      .set("Authorization", `Bearer ${orgA.token}`);

    expect(resA.status).toBe(200);
    expect(resA.body.data).toBeInstanceOf(Array);
    const foundInA = resA.body.data.some((s: any) => s.id === settlement1Id);
    expect(foundInA).toBe(true);

    // Org B request
    const resB = await request(app.getHttpServer())
      .get("/vendor-settlements")
      .set("Authorization", `Bearer ${orgB.token}`);

    expect(resB.status).toBe(200);
    expect(resB.body.data).toBeInstanceOf(Array);
    const foundInB = resB.body.data.some((s: any) => s.id === settlement1Id);
    expect(foundInB).toBe(false);
  });

  it("4. GET /vendor-settlements/:id cross-tenant → 404", async () => {
    const res = await request(app.getHttpServer())
      .get(`/vendor-settlements/${settlement1Id}`)
      .set("Authorization", `Bearer ${orgB.token}`);

    expect(res.status).toBe(404);
  });

  it("5. POST /vendor-settlements/:id/submit → status SUBMITTED", async () => {
    const res = await request(app.getHttpServer())
      .post(`/vendor-settlements/${settlement1Id}/submit`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({ version: 0, notes: "Submitting settlement" });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("SUBMITTED");
    expect(res.body.version).toBe(1);
    expect(res.body.submittedAt).toBeDefined();
  });

  it("6. Full lifecycle: submit → approve → mark-paid all return updated status", async () => {
    // Generate new settlement with trip2
    const createRes = await request(app.getHttpServer())
      .post("/vendor-settlements")
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({
        vendorId: vendorAId,
        tripIds: [trip2Id],
      });

    expect(createRes.status).toBe(201);
    const id = createRes.body.id;
    expect(createRes.body.status).toBe("DRAFT");

    // Submit (DRAFT -> SUBMITTED)
    const submitRes = await request(app.getHttpServer())
      .post(`/vendor-settlements/${id}/submit`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({ version: 0 });

    expect(submitRes.status).toBe(201);
    expect(submitRes.body.status).toBe("SUBMITTED");
    expect(submitRes.body.version).toBe(1);

    // Approve (SUBMITTED -> APPROVED)
    const approveRes = await request(app.getHttpServer())
      .post(`/vendor-settlements/${id}/approve`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({ version: 1 });

    expect(approveRes.status).toBe(201);
    expect(approveRes.body.status).toBe("APPROVED");
    expect(approveRes.body.version).toBe(2);

    // Mark Paid (APPROVED -> PAID)
    const paidRes = await request(app.getHttpServer())
      .post(`/vendor-settlements/${id}/mark-paid`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({ version: 2 });

    expect(paidRes.status).toBe(201);
    expect(paidRes.body.status).toBe("PAID");
    expect(paidRes.body.version).toBe(3);
  });
});
