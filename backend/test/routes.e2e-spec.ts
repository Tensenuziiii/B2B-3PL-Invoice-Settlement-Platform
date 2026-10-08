import { Test } from "@nestjs/testing";
import { HttpStatus, INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaRootService } from "../src/prisma/prisma.service";
import { AllExceptionsFilter } from "../src/common/filters/http-exception.filter";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { tenantStorage } from "../src/core/tenant/tenant.context";

describe("Routes (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaRootService;
  let jwt: JwtService;

  let orgA: { id: string; token: string; userId: string };
  let orgB: { id: string; token: string; userId: string };

  let orgARouteId: string;
  let orgBRouteId: string;

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

    // Cleanup previous test data
    await prisma.route.deleteMany({
      where: { organization: { name: { startsWith: "E2E-RTE-" } } },
    });
    await prisma.user.deleteMany({
      where: { organization: { name: { startsWith: "E2E-RTE-" } } },
    });
    await prisma.organization.deleteMany({
      where: { name: { startsWith: "E2E-RTE-" } },
    });

    // Seed Org A
    const a = await prisma.organization.create({
      data: {
        name: "E2E-RTE-OrgA",
        users: {
          create: {
            email: "admin-a@e2e-rte.test",
            name: "Admin A",
            initials: "AA",
            displayId: "RA-01",
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
        displayId: "RA-01",
        hubName: null,
        orgId: a.id,
        permissions: ["routes:manage"],
      }),
    };

    // Seed Org B
    const b = await prisma.organization.create({
      data: {
        name: "E2E-RTE-OrgB",
        users: {
          create: {
            email: "admin-b@e2e-rte.test",
            name: "Admin B",
            initials: "AB",
            displayId: "RB-01",
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
        displayId: "RB-01",
        hubName: null,
        orgId: b.id,
        permissions: ["routes:manage"],
      }),
    };

    // Seed a route directly for Org B
    const rteB = await prisma.route.create({
      data: {
        organizationId: orgB.id,
        name: "Route B",
        origin: "Pune",
        destination: "Goa",
        expectedKm: 450,
        standardTollEstimate: 200,
        status: "ACTIVE",
      },
    });
    orgBRouteId = rteB.id;
  }, 60000);

  afterAll(async () => {
    if (prisma) {
      await prisma.route.deleteMany({
        where: { organization: { name: { startsWith: "E2E-RTE-" } } },
      });
      await prisma.user.deleteMany({
        where: { organization: { name: { startsWith: "E2E-RTE-" } } },
      });
      await prisma.organization.deleteMany({
        where: { name: { startsWith: "E2E-RTE-" } },
      });
    }
    if (app) {
      await app.close();
    }
  }, 60000);

  it("1. POST /routes creates a route for Org A", async () => {
    const res = await request(app.getHttpServer())
      .post("/routes")
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({
        name: "Route A Mumbai-Pune",
        origin: "Mumbai",
        destination: "Pune",
        expectedKm: 150,
        standardTollEstimate: 350,
      })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe("Route A Mumbai-Pune");
    expect(res.body.origin).toBe("Mumbai");
    expect(res.body.destination).toBe("Pune");
    expect(res.body.expectedKm).toBe(150);
    expect(res.body.standardTollEstimate).toBe(350);
    expect(res.body.status).toBe("ACTIVE");

    orgARouteId = res.body.id;
  }, 30000);

  it("2. Duplicate name returns 409", async () => {
    await request(app.getHttpServer())
      .post("/routes")
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({
        name: "Route A Mumbai-Pune",
        origin: "Mumbai",
        destination: "Pune",
        expectedKm: 150,
      })
      .expect(409);
  }, 30000);

  it("3. Invalid expectedKm (0 or negative) returns 422", async () => {
    await request(app.getHttpServer())
      .post("/routes")
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({
        name: "Route Invalid KM",
        origin: "Delhi",
        destination: "Agra",
        expectedKm: 0,
      })
      .expect(422);
  }, 30000);

  it("4. GET /routes returns only Org A's routes", async () => {
    const res = await request(app.getHttpServer())
      .get("/routes")
      .set("Authorization", `Bearer ${orgA.token}`)
      .expect(200);

    expect(res.body.data).toBeInstanceOf(Array);
    const routeIds = res.body.data.map((r: any) => r.id);
    expect(routeIds).toContain(orgARouteId);
    expect(routeIds).not.toContain(orgBRouteId);
  }, 30000);

  it("5. GET /routes/:id cross-tenant → 404", async () => {
    await request(app.getHttpServer())
      .get(`/routes/${orgBRouteId}`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .expect(404);
  }, 30000);

  it("6. PATCH cross-tenant → 404", async () => {
    await request(app.getHttpServer())
      .patch(`/routes/${orgBRouteId}`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({ name: "Hacked Route" })
      .expect(404);
  }, 30000);

  it("7. DELETE cross-tenant → 404", async () => {
    await request(app.getHttpServer())
      .delete(`/routes/${orgBRouteId}`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .expect(404);
  }, 30000);

  it("8. Missing JWT returns 401", async () => {
    await request(app.getHttpServer())
      .get("/routes")
      .expect(401);
  }, 30000);
});
