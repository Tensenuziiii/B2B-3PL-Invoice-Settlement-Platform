import { Test } from "@nestjs/testing";
import { HttpStatus, INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaRootService } from "../src/prisma/prisma.service";
import { AllExceptionsFilter } from "../src/common/filters/http-exception.filter";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { tenantStorage } from "../src/core/tenant/tenant.context";

describe("Clients (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaRootService;
  let jwt: JwtService;

  let orgA: { id: string; token: string; userId: string };
  let orgB: { id: string; token: string; userId: string };

  let orgAClientId: string;
  let orgBClientId: string;

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
    await prisma.client.deleteMany({
      where: { organization: { name: { startsWith: "E2E-CLT-" } } },
    });
    await prisma.user.deleteMany({
      where: { organization: { name: { startsWith: "E2E-CLT-" } } },
    });
    await prisma.organization.deleteMany({
      where: { name: { startsWith: "E2E-CLT-" } },
    });

    // Seed Org A
    const a = await prisma.organization.create({
      data: {
        name: "E2E-CLT-OrgA",
        users: {
          create: {
            email: "admin-a@e2e-clt.test",
            name: "Admin A",
            initials: "AA",
            displayId: "CA-01",
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
        displayId: "CA-01",
        hubName: null,
        orgId: a.id,
        permissions: ["clients:manage"],
      }),
    };

    // Seed Org B
    const b = await prisma.organization.create({
      data: {
        name: "E2E-CLT-OrgB",
        users: {
          create: {
            email: "admin-b@e2e-clt.test",
            name: "Admin B",
            initials: "AB",
            displayId: "CB-01",
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
        displayId: "CB-01",
        hubName: null,
        orgId: b.id,
        permissions: ["clients:manage"],
      }),
    };

    // Seed a client directly for Org B
    const cltB = await prisma.client.create({
      data: {
        organizationId: orgB.id,
        name: "Client B",
        code: "CLT-B-01",
        status: "ACTIVE",
      },
    });
    orgBClientId = cltB.id;
  }, 60000);

  afterAll(async () => {
    if (prisma) {
      await prisma.client.deleteMany({
        where: { organization: { name: { startsWith: "E2E-CLT-" } } },
      });
      await prisma.user.deleteMany({
        where: { organization: { name: { startsWith: "E2E-CLT-" } } },
      });
      await prisma.organization.deleteMany({
        where: { name: { startsWith: "E2E-CLT-" } },
      });
    }
    if (app) {
      await app.close();
    }
  }, 60000);

  it("1. POST /clients creates a client for Org A", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/clients")
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({
        name: "Client A",
        code: "clt-a-01",
        gstin: "27AABCU9603R1ZN",
        stateCode: "27",
        paymentTermsDays: 45,
      })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe("Client A");
    expect(res.body.code).toBe("CLT-A-01");
    expect(res.body.gstin).toBe("27AABCU9603R1ZN");
    expect(res.body.stateCode).toBe("27");
    expect(res.body.paymentTermsDays).toBe(45);
    expect(res.body.status).toBe("ACTIVE");

    orgAClientId = res.body.id;
  }, 30000);

  it("2. POST with duplicate code returns 409", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/clients")
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({
        name: "Client A Duplicate",
        code: "CLT-A-01",
      })
      .expect(409);
  }, 30000);

  it("3. POST with invalid GSTIN returns 422", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/clients")
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({
        name: "Bad GSTIN Client",
        code: "CLT-A-BAD",
        gstin: "INVALID_GSTIN_123",
      })
      .expect(422);
  }, 30000);

  it("4. GET /clients returns only Org A's clients", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/clients")
      .set("Authorization", `Bearer ${orgA.token}`)
      .expect(200);

    expect(res.body.data).toBeInstanceOf(Array);
    const clientIds = res.body.data.map((c: any) => c.id);
    expect(clientIds).toContain(orgAClientId);
    expect(clientIds).not.toContain(orgBClientId);
  }, 30000);

  it("5. GET /clients/:id as Org A for Org B's client returns 404", async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/clients/${orgBClientId}`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .expect(404);
  }, 30000);

  it("6. PATCH /clients/:id as Org A on Org B's client returns 404", async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/clients/${orgBClientId}`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({ name: "Hacked" })
      .expect(404);
  }, 30000);

  it("7. DELETE /clients/:id as Org A on Org B's client returns 404", async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/clients/${orgBClientId}`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .expect(404);
  }, 30000);

  it("8. Missing JWT returns 401", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/clients")
      .expect(401);
  }, 30000);
});
