import { Test } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaRootService } from "../src/prisma/prisma.service";
import { AllExceptionsFilter } from "../src/common/filters/http-exception.filter";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { tenantStorage } from "../src/core/tenant/tenant.context";

describe("Tenant isolation (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaRootService;
  let jwt: JwtService;

  let orgA: { id: string; token: string; userId: string };
  let orgB: { id: string; token: string; userId: string; userEmail: string };

  beforeAll(async () => {
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
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();

    prisma = app.get(PrismaRootService);
    jwt = app.get(JwtService);

    // Cleanup any previous test orgs
    await prisma.user.deleteMany({
      where: { organization: { name: { startsWith: "E2E-TEST-" } } },
    });
    await prisma.organization.deleteMany({
      where: { name: { startsWith: "E2E-TEST-" } },
    });

    // Seed Org A
    const a = await prisma.organization.create({
      data: {
        name: "E2E-TEST-OrgA",
        users: {
          create: {
            email: "admin-a@e2e.test",
            name: "Admin A",
            initials: "AA",
            displayId: "AA-01",
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
      token: jwt.sign({ sub: a.users[0].id, email: a.users[0].email, role: "ADMIN", displayId: "AA-01", hubName: null, orgId: a.id, permissions: [] }),
    };

    // Seed Org B
    const b = await prisma.organization.create({
      data: {
        name: "E2E-TEST-OrgB",
        users: {
          create: {
            email: "admin-b@e2e.test",
            name: "Admin B",
            initials: "AB",
            displayId: "AB-01",
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
      userEmail: b.users[0].email,
      token: jwt.sign({ sub: b.users[0].id, email: b.users[0].email, role: "ADMIN", displayId: "AB-01", hubName: null, orgId: b.id, permissions: [] }),
    };
  }, 60000);

  afterAll(async () => {
    if (prisma) {
      await prisma.user.deleteMany({
        where: { organization: { name: { startsWith: "E2E-TEST-" } } },
      });
      await prisma.organization.deleteMany({
        where: { name: { startsWith: "E2E-TEST-" } },
      });
    }
    if (app) {
      await app.close();
    }
  }, 60000);

  it("Org A cannot read Org B's user by id (returns 404)", async () => {
    await request(app.getHttpServer())
      .get(`/users/${orgB.userId}`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .expect(404);
  });

  it("Org A cannot list Org B's users (only sees its own)", async () => {
    const res = await request(app.getHttpServer())
      .get("/users")
      .set("Authorization", `Bearer ${orgA.token}`)
      .expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(orgA.userId);
    expect(res.body.data[0].id).not.toBe(orgB.userId);
  });

  it("Org A cannot update Org B's user (returns 404)", async () => {
    await request(app.getHttpServer())
      .patch(`/users/${orgB.userId}`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({ name: "Hacked" })
      .expect(404);
  });

  it("Org A cannot deactivate Org B's user (returns 404)", async () => {
    await request(app.getHttpServer())
      .delete(`/users/${orgB.userId}`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .expect(404);
  });

  it("Errors use the frozen envelope shape", async () => {
    const res = await request(app.getHttpServer())
      .get(`/users/${orgB.userId}`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .expect(404);

    expect(res.body).toEqual({
      error: {
        code: expect.any(String),
        message: expect.any(String),
      },
    });
  });
});
