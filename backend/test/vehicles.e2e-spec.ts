import { Test } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaRootService } from "../src/prisma/prisma.service";
import { AllExceptionsFilter } from "../src/common/filters/http-exception.filter";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { tenantStorage } from "../src/core/tenant/tenant.context";

describe("Vehicles (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaRootService;
  let jwt: JwtService;

  let orgA: { id: string; token: string; userId: string };
  let orgB: { id: string; token: string; userId: string };

  let orgAVehicleId: string;
  let orgBVehicleId: string;

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

    // Cleanup previous test data
    await prisma.vehicle.deleteMany({
      where: { organization: { name: { startsWith: "E2E-VEH-" } } },
    });
    await prisma.user.deleteMany({
      where: { organization: { name: { startsWith: "E2E-VEH-" } } },
    });
    await prisma.organization.deleteMany({
      where: { name: { startsWith: "E2E-VEH-" } },
    });

    // Seed Org A
    const a = await prisma.organization.create({
      data: {
        name: "E2E-VEH-OrgA",
        users: {
          create: {
            email: "admin-a@e2e-veh.test",
            name: "Admin A",
            initials: "AA",
            displayId: "VA-01",
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
        displayId: "VA-01",
        hubName: null,
        orgId: a.id,
        permissions: ["vehicles:manage"],
      }),
    };

    // Seed Org B
    const b = await prisma.organization.create({
      data: {
        name: "E2E-VEH-OrgB",
        users: {
          create: {
            email: "admin-b@e2e-veh.test",
            name: "Admin B",
            initials: "AB",
            displayId: "VB-01",
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
        displayId: "VB-01",
        hubName: null,
        orgId: b.id,
        permissions: ["vehicles:manage"],
      }),
    };

    // Seed a vehicle directly for Org B
    const vehB = await prisma.vehicle.create({
      data: {
        organizationId: orgB.id,
        regNo: "DL-01-BB-9999",
        type: "Van",
        capacityKg: 1500,
        currentOdometer: 8000,
        active: true,
      },
    });
    orgBVehicleId = vehB.id;
  }, 60000);

  afterAll(async () => {
    if (prisma) {
      await prisma.vehicle.deleteMany({
        where: { organization: { name: { startsWith: "E2E-VEH-" } } },
      });
      await prisma.user.deleteMany({
        where: { organization: { name: { startsWith: "E2E-VEH-" } } },
      });
      await prisma.organization.deleteMany({
        where: { name: { startsWith: "E2E-VEH-" } },
      });
    }
    if (app) {
      await app.close();
    }
  }, 60000);

  it("1. POST /vehicles creates a vehicle for Org A", async () => {
    const res = await request(app.getHttpServer())
      .post("/vehicles")
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({
        regNo: "mh-12-aa-1111",
        type: "Truck",
        capacityKg: 5000,
        currentOdometer: 10000,
      })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.regNo).toBe("MH-12-AA-1111");
    expect(res.body.type).toBe("Truck");
    expect(res.body.capacityKg).toBe(5000);
    expect(res.body.currentOdometer).toBe(10000);
    expect(res.body.active).toBe(true);

    orgAVehicleId = res.body.id;
  }, 30000);

  it("2. GET /vehicles returns only Org A's vehicles", async () => {
    const res = await request(app.getHttpServer())
      .get("/vehicles")
      .set("Authorization", `Bearer ${orgA.token}`)
      .expect(200);

    expect(res.body.data).toBeInstanceOf(Array);
    const vehicleIds = res.body.data.map((v: any) => v.id);
    expect(vehicleIds).toContain(orgAVehicleId);
    expect(vehicleIds).not.toContain(orgBVehicleId);
  }, 30000);

  it("3. GET /vehicles/:id as Org A for Org B's vehicle returns 404", async () => {
    await request(app.getHttpServer())
      .get(`/vehicles/${orgBVehicleId}`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .expect(404);
  }, 30000);

  it("4. PATCH /vehicles/:id as Org A on Org B's vehicle returns 404", async () => {
    await request(app.getHttpServer())
      .patch(`/vehicles/${orgBVehicleId}`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({ type: "Hacked" })
      .expect(404);
  }, 30000);

  it("5. DELETE /vehicles/:id as Org A on Org B's vehicle returns 404", async () => {
    await request(app.getHttpServer())
      .delete(`/vehicles/${orgBVehicleId}`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .expect(404);
  }, 30000);

  it("6. Duplicate regNo within same org returns 409", async () => {
    await request(app.getHttpServer())
      .post("/vehicles")
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({
        regNo: "MH-12-AA-1111",
      })
      .expect(409);
  }, 30000);

  it("7. Missing JWT returns 401", async () => {
    await request(app.getHttpServer())
      .get("/vehicles")
      .expect(401);
  }, 30000);
});
