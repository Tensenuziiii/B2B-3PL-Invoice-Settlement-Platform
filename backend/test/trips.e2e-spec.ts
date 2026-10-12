import { Test } from "@nestjs/testing";
import { HttpStatus, INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaRootService } from "../src/prisma/prisma.service";
import { AllExceptionsFilter } from "../src/common/filters/http-exception.filter";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { tenantStorage } from "../src/core/tenant/tenant.context";

describe("Trips (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaRootService;
  let jwt: JwtService;

  let orgA: { id: string; token: string; userId: string };
  let orgB: { id: string; token: string; userId: string };

  let orgATripId: string;
  let orgBTripId: string;
  let driverA: { id: string };
  let vehicleA: { id: string };
  let lifecycleTripId: string;

  async function cleanup() {
    if (!prisma) return;
    const orgs = await prisma.organization.findMany({
      where: { name: { startsWith: "E2E-TRP-" } },
      select: { id: true },
    });
    const orgIds = orgs.map((o) => o.id);
    if (orgIds.length > 0) {
      await prisma.auditReview.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.collection.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.podDocument.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.tripStop.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.trip.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.vehicle.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.driver.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.counter.deleteMany({
        where: {
          organizationId: { in: orgIds },
          entityType: "TRIP",
        },
      });
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

    // Seed Org A
    const a = await prisma.organization.create({
      data: {
        name: "E2E-TRP-OrgA",
        users: {
          create: {
            email: "admin-a@e2e-trp.test",
            name: "Admin A",
            initials: "AA",
            displayId: "TA-01",
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
        displayId: "TA-01",
        hubName: null,
        orgId: a.id,
        permissions: ["trips:manage"],
      }),
    };

    // Seed Org B
    const b = await prisma.organization.create({
      data: {
        name: "E2E-TRP-OrgB",
        users: {
          create: {
            email: "admin-b@e2e-trp.test",
            name: "Admin B",
            initials: "AB",
            displayId: "TB-01",
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
        displayId: "TB-01",
        hubName: null,
        orgId: b.id,
        permissions: ["trips:manage"],
      }),
    };

    // Seed a trip for Org B directly
    const trpB = await prisma.trip.create({
      data: {
        organizationId: orgB.id,
        tripNumber: "TRP-202610-0999",
        origin: "Pune",
        destination: "Goa",
        status: "ASSIGNED",
        tripStops: {
          create: {
            organizationId: orgB.id,
            sequence: 1,
            name: "Goa Terminal",
            expectedQty: 50,
          },
        },
      },
    });
    orgBTripId = trpB.id;

    // Seed Vehicle and Driver for Org A
    const vA = await prisma.vehicle.create({
      data: {
        organizationId: orgA.id,
        regNo: "MH-12-TRP-001",
        currentOdometer: 1000,
      },
    });
    vehicleA = { id: vA.id };

    const dA = await prisma.driver.create({
      data: {
        organizationId: orgA.id,
        name: "Driver A",
        phone: "+919876543210",
      },
    });
    driverA = { id: dA.id };
  }, 60000);

  afterAll(async () => {
    await cleanup();
    if (app) {
      await app.close();
    }
  }, 60000);

  it("1. POST /trips creates trip with stops → tripNumber matches /^TRP-\\d{6}-\\d{4}$/", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/trips")
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({
        origin: "Mumbai Hub",
        destination: "Pune Dock",
        lrNumber: "LR-TRP-001",
        stops: [
          {
            name: "Bhosari Warehouse",
            address: "Plot 12, Bhosari MIDC",
            sequence: 1,
            expectedQty: 40,
            expectedCollection: 12000,
          },
          {
            name: "Hadapsar Hub",
            address: "Magarpatta Road",
            sequence: 2,
            expectedQty: 20,
            expectedCollection: 6000,
          },
        ],
      })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.tripNumber).toMatch(/^TRP-\d{6}-\d{4}$/);
    expect(res.body.tripNumber.endsWith("-0001")).toBe(true);
    expect(res.body.status).toBe("ASSIGNED");
    expect(res.body.tripStops).toBeInstanceOf(Array);
    expect(res.body.tripStops).toHaveLength(2);
    expect(res.body.tripStops[0].name).toBe("Bhosari Warehouse");
    expect(res.body.tripStops[1].name).toBe("Hadapsar Hub");

    orgATripId = res.body.id;
  }, 30000);

  it("2. Second POST creates trip with incrementing sequence (0001, 0002)", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/trips")
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({
        origin: "Mumbai Hub",
        destination: "Nashik Hub",
        stops: [
          {
            name: "Nashik Central",
            expectedQty: 15,
          },
        ],
      })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.tripNumber).toMatch(/^TRP-\d{6}-\d{4}$/);
    expect(res.body.tripNumber.endsWith("-0002")).toBe(true);
  }, 30000);

  it("3. GET /trips returns only Org A's trips", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/trips")
      .set("Authorization", `Bearer ${orgA.token}`)
      .expect(200);

    expect(res.body.data).toBeInstanceOf(Array);
    const tripIds = res.body.data.map((t: any) => t.id);
    expect(tripIds).toContain(orgATripId);
    expect(tripIds).not.toContain(orgBTripId);
  }, 30000);

  it("4. GET /trips/:id cross-tenant → 404", async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/trips/${orgBTripId}`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .expect(404);
  }, 30000);

  it("5. PATCH /trips/:id cross-tenant → 404", async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/trips/${orgBTripId}`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({ origin: "Hacked Origin" })
      .expect(404);
  }, 30000);

  it("6. DELETE /trips/:id cross-tenant → 404", async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/trips/${orgBTripId}`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .expect(404);
  }, 30000);

  it("7. POST /trips with empty stops → 400", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/trips")
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({
        origin: "Mumbai Hub",
        destination: "Pune Hub",
        stops: [],
      })
      .expect(400);
  }, 30000);

  it("8. POST /trips without JWT → 401", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/trips")
      .send({
        origin: "Mumbai Hub",
        destination: "Pune Hub",
        stops: [{ name: "Stop 1" }],
      })
      .expect(401);
  }, 30000);

  it("9. POST /trips/:id/start transitions ASSIGNED → IN_PROGRESS (200, status=IN_PROGRESS, version+1)", async () => {
    const createRes = await request(app.getHttpServer())
      .post("/api/v1/trips")
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({
        origin: "Mumbai Hub",
        destination: "Pune Dock",
        driverId: driverA.id,
        vehicleId: vehicleA.id,
        odometerStart: 1000,
        stops: [{ name: "Stop 1", sequence: 1, expectedQty: 10 }],
      })
      .expect(201);

    lifecycleTripId = createRes.body.id;
    expect(createRes.body.status).toBe("ASSIGNED");
    expect(createRes.body.version).toBe(0);

    const res = await request(app.getHttpServer())
      .post(`/api/v1/trips/${lifecycleTripId}/start`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({ version: 0 })
      .expect(200);

    expect(res.body.id).toBe(lifecycleTripId);
    expect(res.body.status).toBe("IN_PROGRESS");
    expect(res.body.version).toBe(1);
    expect(res.body.startedAt).toBeDefined();
  }, 30000);

  it("10. POST /trips/:id/start with stale version returns 409", async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/trips/${lifecycleTripId}/start`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({ version: 0 })
      .expect(409);
  }, 30000);

  it("11. POST /trips/:id/end with odometerEnd < odometerStart returns 400", async () => {
    const odoTrip = await prisma.trip.create({
      data: {
        organizationId: orgA.id,
        tripNumber: "TRP-202610-0888",
        origin: "Origin",
        destination: "Dest",
        status: "DELIVERY_IN_PROGRESS",
        driverId: driverA.id,
        vehicleId: vehicleA.id,
        odometerStart: 1000,
        version: 0,
      },
    });

    await request(app.getHttpServer())
      .post(`/api/v1/trips/${odoTrip.id}/end`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({ version: 0, odometerEnd: 950 })
      .expect(400);
  }, 30000);

  it("12. POST /trips/:id/audit with invalid status returns 400", async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/trips/${orgATripId}/audit`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({
        version: 0,
        outcome: "AUDITED",
        notes: "Invalid status audit attempt",
      })
      .expect(400);
  }, 30000);

  it("13. Full happy-path flow: create → start → arrive → end → close → audit → ready-for-billing (all 200s, statuses progress)", async () => {
    // 1. Create
    const createRes = await request(app.getHttpServer())
      .post("/api/v1/trips")
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({
        origin: "Alpha Hub",
        destination: "Beta Hub",
        driverId: driverA.id,
        vehicleId: vehicleA.id,
        odometerStart: 500,
        stops: [
          {
            name: "Stop Alpha 1",
            sequence: 1,
            expectedQty: 25,
            expectedCollection: 5000,
          },
        ],
      })
      .expect(201);

    const tripId = createRes.body.id;
    const stopId = createRes.body.tripStops[0].id;
    expect(createRes.body.status).toBe("ASSIGNED");
    expect(createRes.body.version).toBe(0);

    // 2. Start (ASSIGNED → IN_PROGRESS)
    const startRes = await request(app.getHttpServer())
      .post(`/api/v1/trips/${tripId}/start`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({ version: 0 })
      .expect(200);

    expect(startRes.body.status).toBe("IN_PROGRESS");
    expect(startRes.body.version).toBe(1);
    expect(startRes.body.startedAt).toBeDefined();

    // 3. Arrive (IN_PROGRESS → DELIVERY_IN_PROGRESS)
    const arriveRes = await request(app.getHttpServer())
      .post(`/api/v1/trips/${tripId}/arrive`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({ version: 1, tripStopId: stopId })
      .expect(200);

    expect(arriveRes.body.status).toBe("DELIVERY_IN_PROGRESS");
    expect(arriveRes.body.version).toBe(2);

    // 4. End (DELIVERY_IN_PROGRESS → DELIVERED)
    const endRes = await request(app.getHttpServer())
      .post(`/api/v1/trips/${tripId}/end`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({ version: 2, odometerEnd: 560 })
      .expect(200);

    expect(endRes.body.status).toBe("DELIVERED");
    expect(endRes.body.version).toBe(3);
    expect(endRes.body.odometerEnd).toBe(560);
    expect(endRes.body.deliveredAt).toBeDefined();

    // 5. Close (DELIVERED → AUDIT_PENDING)
    const closeRes = await request(app.getHttpServer())
      .post(`/api/v1/trips/${tripId}/close`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({ version: 3 })
      .expect(200);

    expect(closeRes.body.status).toBe("AUDIT_PENDING");
    expect(closeRes.body.version).toBe(4);
    expect(closeRes.body.auditRequestedAt).toBeDefined();
    expect(closeRes.body.closedAt).toBeDefined();

    // 6. Audit (AUDIT_PENDING → AUDITED)
    const auditRes = await request(app.getHttpServer())
      .post(`/api/v1/trips/${tripId}/audit`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({
        version: 4,
        outcome: "AUDITED",
        notes: "All paperwork and POD verified",
      })
      .expect(200);

    expect(auditRes.body.status).toBe("AUDITED");
    expect(auditRes.body.version).toBe(5);
    expect(auditRes.body.auditedAt).toBeDefined();

    // 7. Ready for billing (AUDITED → READY_FOR_BILLING)
    const billingRes = await request(app.getHttpServer())
      .post(`/api/v1/trips/${tripId}/ready-for-billing`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({ version: 5 })
      .expect(200);

    expect(billingRes.body.status).toBe("READY_FOR_BILLING");
    expect(billingRes.body.version).toBe(6);
    expect(billingRes.body.readyForBillingAt).toBeDefined();
  }, 45000);

  it("14. Cross-tenant: Org A cannot start Org B's trip → 404", async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/trips/${orgBTripId}/start`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({ version: 0 })
      .expect(404);
  }, 30000);

  it("35. GET /api/v1/trips/current as DRIVER returns { data: Trip | null }", async () => {
    const ts = Date.now().toString();
    const driverUser = await prisma.user.create({
      data: {
        organizationId: orgA.id,
        email: `driver-curr-${ts}@e2e-trp.test`,
        name: "Current Driver",
        initials: "CD",
        displayId: `D-${ts.slice(-4)}`,
        role: "DRIVER",
        passwordHash: await argon2.hash("Enterprise@2026"),
      },
    });

    const driverToken = jwt.sign({
      sub: driverUser.id,
      email: driverUser.email,
      role: "DRIVER",
      displayId: `D-${ts.slice(-4)}`,
      hubName: null,
      orgId: orgA.id,
      permissions: [],
    });

    const res = await request(app.getHttpServer())
      .get("/api/v1/trips/current")
      .set("Authorization", `Bearer ${driverToken}`)
      .expect(200);

    expect(res.body).toHaveProperty("data");
    expect(res.body.data).toBeNull();

    const driver = await prisma.driver.create({
      data: {
        organizationId: orgA.id,
        name: "Driver CD",
        phone: `+91${ts.slice(-10)}`,
        userId: driverUser.id,
      },
    });

    const activeTrip = await prisma.trip.create({
      data: {
        organizationId: orgA.id,
        tripNumber: `TRP-CURR-${ts.slice(-6)}`,
        origin: "Origin Hub",
        destination: "Destination Dock",
        status: "IN_PROGRESS",
        driverId: driver.id,
        tripStops: {
          create: {
            organizationId: orgA.id,
            sequence: 1,
            name: "Stop 1",
            expectedQty: 10,
          },
        },
      },
    });

    const resActive = await request(app.getHttpServer())
      .get("/api/v1/trips/current")
      .set("Authorization", `Bearer ${driverToken}`)
      .expect(200);

    expect(resActive.body).toHaveProperty("data");
    expect(resActive.body.data).not.toBeNull();
    expect(resActive.body.data.id).toBe(activeTrip.id);
    expect(resActive.body.data.status).toBe("IN_PROGRESS");
    expect(resActive.body.data.tripStops).toHaveLength(1);
  }, 30000);

  it("36. GET /api/v1/trips/current without JWT returns 401", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/trips/current")
      .expect(401);
  }, 30000);
});
