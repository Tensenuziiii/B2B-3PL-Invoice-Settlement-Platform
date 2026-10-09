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

  async function cleanup() {
    if (!prisma) return;
    const orgs = await prisma.organization.findMany({
      where: { name: { startsWith: "E2E-TRP-" } },
      select: { id: true },
    });
    const orgIds = orgs.map((o) => o.id);
    if (orgIds.length > 0) {
      await prisma.collection.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.podDocument.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.tripStop.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.trip.deleteMany({ where: { organizationId: { in: orgIds } } });
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
  }, 60000);

  afterAll(async () => {
    await cleanup();
    if (app) {
      await app.close();
    }
  }, 60000);

  it("1. POST /trips creates trip with stops → tripNumber matches /^TRP-\\d{6}-\\d{4}$/", async () => {
    const res = await request(app.getHttpServer())
      .post("/trips")
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
      .post("/trips")
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
      .get("/trips")
      .set("Authorization", `Bearer ${orgA.token}`)
      .expect(200);

    expect(res.body.data).toBeInstanceOf(Array);
    const tripIds = res.body.data.map((t: any) => t.id);
    expect(tripIds).toContain(orgATripId);
    expect(tripIds).not.toContain(orgBTripId);
  }, 30000);

  it("4. GET /trips/:id cross-tenant → 404", async () => {
    await request(app.getHttpServer())
      .get(`/trips/${orgBTripId}`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .expect(404);
  }, 30000);

  it("5. PATCH /trips/:id cross-tenant → 404", async () => {
    await request(app.getHttpServer())
      .patch(`/trips/${orgBTripId}`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({ origin: "Hacked Origin" })
      .expect(404);
  }, 30000);

  it("6. DELETE /trips/:id cross-tenant → 404", async () => {
    await request(app.getHttpServer())
      .delete(`/trips/${orgBTripId}`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .expect(404);
  }, 30000);

  it("7. POST /trips with empty stops → 400", async () => {
    await request(app.getHttpServer())
      .post("/trips")
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
      .post("/trips")
      .send({
        origin: "Mumbai Hub",
        destination: "Pune Hub",
        stops: [{ name: "Stop 1" }],
      })
      .expect(401);
  }, 30000);
});
