import { Test } from "@nestjs/testing";
import { HttpStatus, INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaRootService } from "../src/prisma/prisma.service";
import { AllExceptionsFilter } from "../src/common/filters/http-exception.filter";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { tenantStorage } from "../src/core/tenant/tenant.context";

describe("RateCards (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaRootService;
  let jwt: JwtService;

  let orgA: { id: string; token: string; userId: string };
  let orgB: { id: string; token: string; userId: string };

  let orgAClientId: string;
  let orgBClientId: string;

  let orgARateCardId: string;
  let orgBRateCardId: string;
  let metroClientId: string;

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
    await prisma.rateCardItem.deleteMany({
      where: { organization: { name: { startsWith: "E2E-RC-" } } },
    });
    await prisma.rateCard.deleteMany({
      where: { organization: { name: { startsWith: "E2E-RC-" } } },
    });
    await prisma.client.deleteMany({
      where: { organization: { name: { startsWith: "E2E-RC-" } } },
    });
    await prisma.user.deleteMany({
      where: { organization: { name: { startsWith: "E2E-RC-" } } },
    });
    await prisma.organization.deleteMany({
      where: { name: { startsWith: "E2E-RC-" } },
    });

    // Seed Org A
    const a = await prisma.organization.create({
      data: {
        name: "E2E-RC-OrgA",
        users: {
          create: {
            email: "admin-a@e2e-rc.test",
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
        permissions: ["rate_cards:manage"],
      }),
    };

    const clientA = await prisma.client.create({
      data: {
        organizationId: orgA.id,
        name: "Client A",
        code: "CLI-A-01",
        status: "ACTIVE",
      },
    });
    orgAClientId = clientA.id;

    // Seed Org B
    const b = await prisma.organization.create({
      data: {
        name: "E2E-RC-OrgB",
        users: {
          create: {
            email: "admin-b@e2e-rc.test",
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
        permissions: ["rate_cards:manage"],
      }),
    };

    const clientB = await prisma.client.create({
      data: {
        organizationId: orgB.id,
        name: "Client B",
        code: "CLI-B-01",
        status: "ACTIVE",
      },
    });
    orgBClientId = clientB.id;

    // Seed rate card directly for Org B
    const rcB = await prisma.rateCard.create({
      data: {
        organizationId: orgB.id,
        name: "RC Org B",
        counterpartyType: "CLIENT",
        clientId: orgBClientId,
        validFrom: new Date("2026-04-01T00:00:00.000Z"),
        status: "ACTIVE",
        items: {
          create: [
            {
              organizationId: orgB.id,
              rateType: "FIXED_TRIP",
              rate: 2000000,
            },
          ],
        },
      },
    });
    orgBRateCardId = rcB.id;

    // Ensure METRO-WHOLESALE client and METRO-STD-2026 rate card exist
    let metroClient = await prisma.client.findFirst({
      where: { code: "METRO-WHOLESALE" },
    });
    if (!metroClient) {
      const defaultOrg =
        (await prisma.organization.findFirst({ where: { name: { contains: "Vecto" } } })) ??
        (await prisma.organization.findFirst());
      if (defaultOrg) {
        metroClient = await prisma.client.create({
          data: {
            organizationId: defaultOrg.id,
            name: "Metro Cash & Carry India Pvt Ltd",
            code: "METRO-WHOLESALE",
            status: "ACTIVE",
          },
        });
      }
    }
    if (metroClient) {
      const existingRc = await prisma.rateCard.findFirst({
        where: { clientId: metroClient.id, name: "METRO-STD-2026" },
      });
      if (!existingRc) {
        await prisma.rateCard.create({
          data: {
            organizationId: metroClient.organizationId,
            name: "METRO-STD-2026",
            counterpartyType: "CLIENT",
            clientId: metroClient.id,
            validFrom: new Date("2026-04-01T00:00:00.000Z"),
            status: "ACTIVE",
            items: {
              create: [
                { organizationId: metroClient.organizationId, rateType: "FIXED_TRIP", rate: 2500000, tripType: "FTL" },
                { organizationId: metroClient.organizationId, rateType: "PER_DELIVERY", rate: 150000, tripType: "PTL" },
                { organizationId: metroClient.organizationId, rateType: "PER_KM", rate: 5500, tripType: "FTL", serviceType: "STANDARD" },
              ],
            },
          },
        });
      }
      metroClientId = metroClient.id;
    }
  }, 60000);

  afterAll(async () => {
    if (prisma) {
      await prisma.rateCardItem.deleteMany({
        where: { organization: { name: { startsWith: "E2E-RC-" } } },
      });
      await prisma.rateCard.deleteMany({
        where: { organization: { name: { startsWith: "E2E-RC-" } } },
      });
      await prisma.client.deleteMany({
        where: { organization: { name: { startsWith: "E2E-RC-" } } },
      });
      await prisma.user.deleteMany({
        where: { organization: { name: { startsWith: "E2E-RC-" } } },
      });
      await prisma.organization.deleteMany({
        where: { name: { startsWith: "E2E-RC-" } },
      });
    }
    if (app) {
      await app.close();
    }
  }, 60000);

  it("1. POST /rate-cards creates card with items", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/rate-cards")
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({
        name: "RC Org A Standard",
        counterpartyType: "CLIENT",
        clientId: orgAClientId,
        validFrom: "2026-04-01T00:00:00.000Z",
        validTo: "2027-03-31T23:59:59.000Z",
        items: [
          { rateType: "FIXED_TRIP", rate: 2500000, tripType: "FTL" },
          { rateType: "PER_KM", rate: 5500, tripType: "FTL", serviceType: "STANDARD" },
        ],
      })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe("RC Org A Standard");
    expect(res.body.counterpartyType).toBe("CLIENT");
    expect(res.body.clientId).toBe(orgAClientId);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items[0].organizationId).toBe(orgA.id);
    expect(res.body.items[1].organizationId).toBe(orgA.id);
    expect(res.body.items[0].organizationId).toBe(res.body.organizationId);

    orgARateCardId = res.body.id;
  }, 30000);

  it("2. POST returns 400 when CLIENT type missing clientId", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/rate-cards")
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({
        name: "Missing Client ID",
        counterpartyType: "CLIENT",
        validFrom: "2026-04-01T00:00:00.000Z",
        items: [{ rateType: "FIXED_TRIP", rate: 1000 }],
      })
      .expect(400);
  }, 30000);

  it("3. POST returns 400 when items empty", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/rate-cards")
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({
        name: "Empty Items",
        counterpartyType: "CLIENT",
        clientId: orgAClientId,
        validFrom: "2026-04-01T00:00:00.000Z",
        items: [],
      })
      .expect(400);
  }, 30000);

  it("4. POST returns 400 when validTo <= validFrom", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/rate-cards")
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({
        name: "Invalid Dates",
        counterpartyType: "CLIENT",
        clientId: orgAClientId,
        validFrom: "2026-04-01T00:00:00.000Z",
        validTo: "2026-03-31T00:00:00.000Z",
        items: [{ rateType: "FIXED_TRIP", rate: 1000 }],
      })
      .expect(400);
  }, 30000);

  it("5. GET /rate-cards returns only Org A's rate cards", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/rate-cards")
      .set("Authorization", `Bearer ${orgA.token}`)
      .expect(200);

    expect(res.body.data).toBeInstanceOf(Array);
    const ids = res.body.data.map((rc: any) => rc.id);
    expect(ids).toContain(orgARateCardId);
    expect(ids).not.toContain(orgBRateCardId);
  }, 30000);

  it("6. GET /rate-cards/:id returns card with items", async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/rate-cards/${orgARateCardId}`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .expect(200);

    expect(res.body.id).toBe(orgARateCardId);
    expect(res.body.items).toBeInstanceOf(Array);
    expect(res.body.items.length).toBeGreaterThanOrEqual(2);
  }, 30000);

  it("7. GET cross-tenant → 404", async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/rate-cards/${orgBRateCardId}`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .expect(404);
  }, 30000);

  it("8. PATCH cross-tenant → 404", async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/rate-cards/${orgBRateCardId}`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({ name: "Hacked" })
      .expect(404);
  }, 30000);

  it("9. POST /rate-cards/:id/items appends item", async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/rate-cards/${orgARateCardId}/items`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({
        rateType: "PER_DELIVERY",
        rate: 150000,
        tripType: "PTL",
      })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.rateType).toBe("PER_DELIVERY");
    expect(res.body.rate).toBe(150000);
    expect(res.body.organizationId).toBe(orgA.id);

    const getRes = await request(app.getHttpServer())
      .get(`/api/v1/rate-cards/${orgARateCardId}`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .expect(200);

    expect(getRes.body.items).toHaveLength(3);
  }, 30000);

  it("10. DELETE cross-tenant → 404", async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/rate-cards/${orgBRateCardId}`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .expect(404);
  }, 30000);

  it("11. POST /rate-cards/resolve returns the seeded METRO-STD-2026 FIXED_TRIP item", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/rate-cards/resolve")
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({
        counterpartyType: "CLIENT",
        counterpartyId: metroClientId,
        rateType: "FIXED_TRIP",
        onDate: "2026-06-15",
      })
      .expect(200);

    expect(res.body.rate).toBe(2500000);
    expect(res.body.rateCardName).toBe("METRO-STD-2026");
  }, 30000);

  it("12. POST /rate-cards/resolve returns 404 for a date before the card's validFrom", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/rate-cards/resolve")
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({
        counterpartyType: "CLIENT",
        counterpartyId: metroClientId,
        rateType: "FIXED_TRIP",
        onDate: "2025-01-01",
      })
      .expect(404);

    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe("NOT_FOUND");
  }, 30000);

  it("13. POST /rate-cards/resolve returns 404 when counterparty has no cards", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/rate-cards/resolve")
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({
        counterpartyType: "CLIENT",
        counterpartyId: "a0000000-0000-4000-8000-000000000099",
        rateType: "FIXED_TRIP",
        onDate: "2026-06-15",
      })
      .expect(404);

    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe("NOT_FOUND");
  }, 30000);

  it("14. POST /rate-cards/resolve route ordering — /resolve does NOT match :id", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/rate-cards/resolve")
      .set("Authorization", `Bearer ${orgA.token}`)
      .send({
        counterpartyType: "CLIENT",
        counterpartyId: metroClientId,
        rateType: "FIXED_TRIP",
        onDate: "2026-06-15",
      })
      .expect(200);

    expect(res.body.rateCardId).toBeDefined();
    expect(res.body.rateCardItemId).toBeDefined();
    expect(res.body.rate).toBe(2500000);
  }, 30000);
});
