import { Test } from "@nestjs/testing";
import { HttpStatus, INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaRootService } from "../src/prisma/prisma.service";
import { AllExceptionsFilter } from "../src/common/filters/http-exception.filter";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { tenantStorage } from "../src/core/tenant/tenant.context";

describe("Drivers (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaRootService;
  let jwt: JwtService;

  let orgA: { id: string; token: string; userId: string };
  let orgB: { id: string; token: string; userId: string };

  let orgADriverId: string;
  let orgBDriverId: string;

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

    // Cleanup previous test data
    await prisma.driver.deleteMany({
      where: { organization: { name: { startsWith: "E2E-DRV-" } } },
    });
    await prisma.user.deleteMany({
      where: { organization: { name: { startsWith: "E2E-DRV-" } } },
    });
    await prisma.organization.deleteMany({
      where: { name: { startsWith: "E2E-DRV-" } },
    });

    // Seed Org A
    const a = await prisma.organization.create({
      data: {
        name: "E2E-DRV-OrgA",
        users: {
          create: {
            email: "admin-a@e2e-drv.test",
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
      token: jwt.sign({
        sub: a.users[0].id,
        email: a.users[0].email,
        role: "ADMIN",
        displayId: "DA-01",
        hubName: null,
        orgId: a.id,
        permissions: ["drivers:manage"],
      }),
    };

    // Seed Org B
    const b = await prisma.organization.create({
      data: {
        name: "E2E-DRV-OrgB",
        users: {
          create: {
            email: "admin-b@e2e-drv.test",
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
      token: jwt.sign({
        sub: b.users[0].id,
        email: b.users[0].email,
        role: "ADMIN",
        displayId: "DB-01",
        hubName: null,
        orgId: b.id,
        permissions: ["drivers:manage"],
      }),
    };

    // Seed a driver directly for Org B
    const drvB = await prisma.driver.create({
      data: {
        organizationId: orgB.id,
        name: "Driver B",
        phone: "+919876543211",
        licenseNo: "DL-02-2026-0002",
        active: true,
      },
    });
    orgBDriverId = drvB.id;
  }, 60000);

  afterAll(async () => {
    if (prisma) {
      await prisma.driver.deleteMany({
        where: { organization: { name: { startsWith: "E2E-DRV-" } } },
      });
      await prisma.user.deleteMany({
        where: { organization: { name: { startsWith: "E2E-DRV-" } } },
      });
      await prisma.organization.deleteMany({
        where: { name: { startsWith: "E2E-DRV-" } },
      });
    }
    if (app) {
      await app.close();
    }
  }, 60000);

  it("1. POST /drivers creates a driver for Org A", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/drivers")
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({
        name: "Driver A",
        phone: "+919876543210",
        licenseNo: "DL-01-2026-0001",
        licenseExpiry: "2030-01-01T00:00:00.000Z",
      })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe("Driver A");
    expect(res.body.phone).toBe("+919876543210");
    expect(res.body.licenseNo).toBe("DL-01-2026-0001");
    expect(res.body.active).toBe(true);

    orgADriverId = res.body.id;
  }, 30000);

  it("2. GET /drivers returns only Org A's drivers", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/drivers")
      .set("Authorization", `Bearer ${orgA.token}`)
      .expect(200);

    expect(res.body.data).toBeInstanceOf(Array);
    const driverIds = res.body.data.map((d: any) => d.id);
    expect(driverIds).toContain(orgADriverId);
    expect(driverIds).not.toContain(orgBDriverId);
  }, 30000);

  it("3. GET /drivers/:id as Org A for Org B's driver returns 404", async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/drivers/${orgBDriverId}`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .expect(404);
  }, 30000);

  it("4. PATCH /drivers/:id as Org A on Org B's driver returns 404", async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/drivers/${orgBDriverId}`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({ name: "Hacked" })
      .expect(404);
  }, 30000);

  it("5. DELETE /drivers/:id as Org A on Org B's driver returns 404", async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/drivers/${orgBDriverId}`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .expect(404);
  }, 30000);

  it("6. Duplicate phone within same org returns 409", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/drivers")
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({
        name: "Driver A Duplicate",
        phone: "+919876543210",
      })
      .expect(409);
  }, 30000);

  it("7. Invalid phone returns 422", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/drivers")
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({
        name: "Invalid Phone Driver",
        phone: "12345",
      })
      .expect(422);
  }, 30000);

  it("8. Missing JWT returns 401", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/drivers")
      .expect(401);
  }, 30000);
});
