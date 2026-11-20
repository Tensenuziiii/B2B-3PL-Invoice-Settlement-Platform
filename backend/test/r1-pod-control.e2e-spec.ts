import { Test } from "@nestjs/testing";
import { HttpStatus, INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaRootService } from "../src/prisma/prisma.service";
import { AllExceptionsFilter } from "../src/common/filters/http-exception.filter";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { tenantStorage } from "../src/core/tenant/tenant.context";

describe("R1 POD Control & Invoicing Lifecycle (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaRootService;
  let jwt: JwtService;

  let org: { id: string; adminToken: string; staffToken: string; accountsToken: string; driverToken: string; adminId: string };
  let clientId: string;
  let ownerId: string;
  let vehicleId: string;
  let driverId: string;
  let tripId: string;
  let tripStopId: string;
  let podId: string;
  let invoiceId: string;

  beforeAll(async () => {
    jest.setTimeout(60000);
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
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

    await app.init();
    prisma = app.get(PrismaRootService);
    jwt = app.get(JwtService);

    // Clean up any old test data
    await prisma.invoiceFollowUp.deleteMany({ where: { invoice: { client: { name: "R1-E2E-Client" } } } });
    await prisma.invoiceStage.deleteMany({ where: { invoice: { client: { name: "R1-E2E-Client" } } } });
    await prisma.payment.deleteMany({ where: { invoice: { client: { name: "R1-E2E-Client" } } } });
    await prisma.invoiceLine.deleteMany({ where: { invoice: { client: { name: "R1-E2E-Client" } } } });
    await prisma.invoice.deleteMany({ where: { client: { name: "R1-E2E-Client" } } });
    await prisma.podEvent.deleteMany({ where: { pod: { trip: { client: { name: "R1-E2E-Client" } } } } });
    await prisma.podCheckItem.deleteMany({ where: { pod: { trip: { client: { name: "R1-E2E-Client" } } } } });
    await prisma.pod.deleteMany({ where: { trip: { client: { name: "R1-E2E-Client" } } } });
    await prisma.podDocument.deleteMany({ where: { tripStop: { trip: { client: { name: "R1-E2E-Client" } } } } });
    await prisma.tripStatusEvent.deleteMany({ where: { trip: { client: { name: "R1-E2E-Client" } } } });
    await prisma.tripStop.deleteMany({ where: { trip: { client: { name: "R1-E2E-Client" } } } });
    await prisma.trip.deleteMany({ where: { client: { name: "R1-E2E-Client" } } });
    await prisma.approvalStageTemplate.deleteMany({ where: { client: { name: "R1-E2E-Client" } } });
    await prisma.customerDocumentRule.deleteMany({ where: { client: { name: "R1-E2E-Client" } } });
    await prisma.customerContact.deleteMany({ where: { client: { name: "R1-E2E-Client" } } });
    await prisma.client.deleteMany({ where: { name: "R1-E2E-Client" } });
    await prisma.vehicle.deleteMany({ where: { regNo: "MH12-R1-9999" } });
    await prisma.driver.deleteMany({ where: { phone: "9876543299" } });
    await prisma.owner.deleteMany({ where: { pan: "ABCDE1234F" } });
    await prisma.user.deleteMany({ where: { organization: { name: "R1-E2E-Org" } } });
    await prisma.counter.deleteMany({ where: { organization: { name: "R1-E2E-Org" } } });
    await prisma.organization.deleteMany({ where: { name: "R1-E2E-Org" } });

    // Seed test organization
    const orgRecord = await prisma.organization.create({
      data: {
        name: "R1-E2E-Org",
        users: {
          create: [
            {
              email: "admin@r1-e2e.test",
              name: "Admin User",
              initials: "AU",
              displayId: "ADM-01",
              role: "ADMIN",
              passwordHash: await argon2.hash("Password@123"),
            },
            {
              email: "staff@r1-e2e.test",
              name: "Staff User",
              initials: "SU",
              displayId: "STF-01",
              role: "STAFF",
              passwordHash: await argon2.hash("Password@123"),
            },
            {
              email: "accounts@r1-e2e.test",
              name: "Accounts User",
              initials: "AC",
              displayId: "ACC-01",
              role: "ACCOUNTS",
              passwordHash: await argon2.hash("Password@123"),
            },
            {
              email: "driver@r1-e2e.test",
              name: "Driver User",
              initials: "DU",
              displayId: "DRV-01",
              role: "DRIVER",
              passwordHash: await argon2.hash("Password@123"),
            },
          ],
        },
      },
      include: { users: true },
    });

    const adminUser = orgRecord.users.find((u) => u.role === "ADMIN")!;
    const staffUser = orgRecord.users.find((u) => u.role === "STAFF")!;
    const accountsUser = orgRecord.users.find((u) => u.role === "ACCOUNTS")!;
    const driverUser = orgRecord.users.find((u) => u.role === "DRIVER")!;

    org = {
      id: orgRecord.id,
      adminId: adminUser.id,
      adminToken: jwt.sign({ sub: adminUser.id, email: adminUser.email, role: "ADMIN", orgId: orgRecord.id }),
      staffToken: jwt.sign({ sub: staffUser.id, email: staffUser.email, role: "STAFF", orgId: orgRecord.id }),
      accountsToken: jwt.sign({ sub: accountsUser.id, email: accountsUser.email, role: "ACCOUNTS", orgId: orgRecord.id }),
      driverToken: jwt.sign({ sub: driverUser.id, email: driverUser.email, role: "DRIVER", orgId: orgRecord.id }),
    };
  });

  afterAll(async () => {
    await app.close();
  });

  describe("Step 1: Master Data Extensions & Setup", () => {
    it("creates a client with ApprovalStageTemplates and DocumentRules", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/clients")
        .set("Authorization", `Bearer ${org.adminToken}`)
        .send({
          name: "R1-E2E-Client",
          code: "R1CLT",
          gstin: "27AABCU9603R1ZM",
          stateCode: "27",
          creditDays: 30,
        })
        .expect(201);

      clientId = res.body.id;
      expect(clientId).toBeDefined();

      // Create Stage 1 Template: Operations Review (STAFF)
      await request(app.getHttpServer())
        .post(`/api/v1/clients/${clientId}/approval-templates`)
        .set("Authorization", `Bearer ${org.adminToken}`)
        .send({
          name: "Operations Verification",
          sequence: 1,
        })
        .expect(201);

      // Create Stage 2 Template: Finance Signoff (ACCOUNTS)
      await request(app.getHttpServer())
        .post(`/api/v1/clients/${clientId}/approval-templates`)
        .set("Authorization", `Bearer ${org.adminToken}`)
        .send({
          name: "Finance Signoff",
          sequence: 2,
        })
        .expect(201);

      // Create Customer Document Rule
      await request(app.getHttpServer())
        .post(`/api/v1/clients/${clientId}/document-rules`)
        .set("Authorization", `Bearer ${org.adminToken}`)
        .send({
          documentType: "PHYSICAL_POD",
          isMandatory: true,
          notes: "Requires consignee stamp and receiver signature",
        })
        .expect(201);
    });

    it("creates owner, vehicle, and driver with valid verifications", async () => {
      // 1. Owner
      const ownerRes = await request(app.getHttpServer())
        .post("/api/v1/owners")
        .set("Authorization", `Bearer ${org.adminToken}`)
        .send({
          name: "R1 Fleet Owner",
          phone: "9876543210",
          pan: "ABCDE1234F",
          partyType: "INDIVIDUAL",
        })
        .expect(201);
      ownerId = ownerRes.body.id;

      // 2. Vehicle with future fitness, insurance, and PUC
      const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
      const vehicleRes = await request(app.getHttpServer())
        .post("/api/v1/vehicles")
        .set("Authorization", `Bearer ${org.adminToken}`)
        .send({
          regNo: "MH12-R1-9999",
          type: "32FT_MXL",
          capacityKg: 14000,
          currentOdometer: 10000,
          ownerId,
          fitnessExpiry: futureDate,
          insuranceExpiry: futureDate,
          pucExpiry: futureDate,
        })
        .expect(201);
      vehicleId = vehicleRes.body.id;

      // 3. Driver with valid verificationStatus
      const driverRes = await request(app.getHttpServer())
        .post("/api/v1/drivers")
        .set("Authorization", `Bearer ${org.adminToken}`)
        .send({
          name: "R1 Pro Driver",
          phone: "9876543299",
          licenseNo: "MH12-2020-009988",
          licenseExpiry: futureDate,
          verificationStatus: "VERIFIED",
        })
        .expect(201);
      driverId = driverRes.body.id;
    });
  });

  describe("Step 2: Trip Placement & Assignment Guard Validation", () => {
    it("successfully creates trip with valid vehicle and driver without warnings", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/trips")
        .set("Authorization", `Bearer ${org.adminToken}`)
        .send({
          clientId,
          vehicleId,
          driverId,
          origin: "Pune Hub",
          destination: "Mumbai Hub",
          stops: [{ name: "Mumbai Hub", sequence: 1 }],
        })
        .expect(201);

      tripId = res.body.id;
      expect(tripId).toBeDefined();
      expect(res.body.status).toBe("ASSIGNED");
    });

    it("verifies stops and retrieves primary tripStopId", async () => {
      const tripRes = await request(app.getHttpServer())
        .get(`/api/v1/trips/${tripId}`)
        .set("Authorization", `Bearer ${org.adminToken}`)
        .expect(200);

      const stops = tripRes.body.tripStops || [];
      expect(stops.length).toBeGreaterThan(0);
      tripStopId = stops[0].id;
    });
  });

  describe("Step 3: Canonical Trip Lifecycle & Auto-POD Creation", () => {
    it("advances status step-by-step: PLACED -> LOADING -> LOADED -> IN_TRANSIT -> UNLOADING -> DELIVERED", async () => {
      const transitions = [
        { toStatus: "LOADING", reason: "Vehicle arrived at dock" },
        { toStatus: "LOADED", reason: "Loading completed, sealed" },
        { toStatus: "IN_TRANSIT", reason: "Departed Pune Hub" },
        { toStatus: "UNLOADING", reason: "Arrived at Mumbai dock" },
        { toStatus: "DELIVERED", reason: "Consignment delivered to consignee" },
      ];

      for (const t of transitions) {
        const res = await request(app.getHttpServer())
          .post(`/api/v1/trips/${tripId}/status-transitions`)
          .set("Authorization", `Bearer ${org.staffToken}`)
          .send({
            toStatus: t.toStatus,
            reason: t.reason,
          })
          .expect(200);

        expect(res.body.status).toBe(t.toStatus);
      }

      // Check TripStatusEvents append-only log
      const eventsRes = await request(app.getHttpServer())
        .get(`/api/v1/trips/${tripId}/status-events`)
        .set("Authorization", `Bearer ${org.staffToken}`)
        .expect(200);

      expect(eventsRes.body.length).toBe(5);
    });

    it("verifies that DELIVERED automatically spawned a Pod record in PENDING_DELIVERY", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/pods/by-trip/${tripId}`)
        .set("Authorization", `Bearer ${org.staffToken}`)
        .expect(200);

      expect(res.body).toBeDefined();
      podId = res.body.id;
      expect(podId).toBeDefined();
      expect(res.body.tripId).toBe(tripId);
      expect(res.body.currentStatus).toBe("PENDING_DELIVERY");
    });
  });

  describe("Step 4: POD Control - Soft Copy, Checklist & Hold Management", () => {
    it("advances POD to SOFT_COPY_RECEIVED", async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/pods/control/${podId}/soft-copy-received`)
        .set("Authorization", `Bearer ${org.staffToken}`)
        .expect(200);

      expect(res.body.currentStatus).toBe("SOFT_COPY_RECEIVED");
    });

    it("submits checklist with a failed item -> transitions POD to ON_HOLD", async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/pods/control/${podId}/checklist`)
        .set("Authorization", `Bearer ${org.staffToken}`)
        .send({
          items: [
            { itemCode: "STAMP", result: "FAIL", notes: "Consignee gate stamp missing" },
            { itemCode: "SIGNATURE", result: "PASS" },
            { itemCode: "DATE", result: "PASS" },
            { itemCode: "REMARKS", result: "PASS" },
            { itemCode: "DAMAGE", result: "PASS" },
          ],
        })
        .expect(200);

      expect(res.body.currentStatus).toBe("ON_HOLD");
      expect(res.body.holdReason).toBe("Checklist failure");
    });

    it("blocks invoice generation while POD is ON_HOLD", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/invoices/generate-from-pod")
        .set("Authorization", `Bearer ${org.accountsToken}`)
        .send({ podId })
        .expect(HttpStatus.BAD_REQUEST);
    });

    it("releases POD hold with remarks -> transitions back to SOFT_COPY_RECEIVED", async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/pods/control/${podId}/release-hold`)
        .set("Authorization", `Bearer ${org.staffToken}`)
        .send({ reason: "Consignee gate inward stamp confirmed via email" })
        .expect(200);

      expect(res.body.currentStatus).toBe("SOFT_COPY_RECEIVED");
    });

    it("submits all-passing 5-point checklist -> transitions to SOFT_COPY_CHECKED", async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/pods/control/${podId}/checklist`)
        .set("Authorization", `Bearer ${org.staffToken}`)
        .send({
          items: [
            { itemCode: "STAMP", result: "PASS", notes: "Stamp verified" },
            { itemCode: "SIGNATURE", result: "PASS", notes: "Sign confirmed" },
            { itemCode: "DATE", result: "PASS", notes: "Delivery date recorded" },
            { itemCode: "REMARKS", result: "PASS", notes: "No shortage" },
            { itemCode: "DAMAGE", result: "PASS", notes: "Intact packaging" },
          ],
        })
        .expect(200);

      expect(res.body.currentStatus).toBe("SOFT_COPY_CHECKED");
    });
  });

  describe("Step 5: Physical Original POD Tracking", () => {
    it("dispatches original POD via courier -> transitions to ORIGINAL_DISPATCHED", async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/pods/control/${podId}/dispatch-courier`)
        .set("Authorization", `Bearer ${org.staffToken}`)
        .send({
          courierName: "BlueDart Express",
          courierTrackingNo: "BD-88992211",
        })
        .expect(200);

      expect(res.body.currentStatus).toBe("ORIGINAL_DISPATCHED");
      expect(res.body.courierName).toBe("BlueDart Express");
      expect(res.body.courierTrackingNo).toBe("BD-88992211");
    });

    it("office confirms original receipt -> transitions to ORIGINAL_RECEIVED", async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/pods/control/${podId}/mark-received`)
        .set("Authorization", `Bearer ${org.staffToken}`)
        .expect(200);

      expect(res.body.currentStatus).toBe("ORIGINAL_RECEIVED");
      expect(res.body.originalReceivedAt).toBeDefined();
    });
  });

  describe("Step 6: Invoice Generation from POD & Stage Snapshotting", () => {
    it("generates invoice from verified POD with snapshotted approval stages", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/invoices/generate-from-pod")
        .set("Authorization", `Bearer ${org.accountsToken}`)
        .send({ podId, subtotal: 2550000 })
        .expect(201);

      expect(res.body.id).toBeDefined();
      invoiceId = res.body.id;
      expect(res.body.invoiceNumber).toMatch(/^INV-/);
      expect(res.body.status).toBe("DRAFT");

      // Verify paise calculation (subtotal 25,500.00 + 18% GST 4,590.00 = 30,090.00)
      expect(res.body.subtotal).toBe(2550000);
      expect(res.body.gstAmount).toBe(459000);
      expect(res.body.total).toBe(3009000);
    });

    it("prevents duplicate invoice generation from the same POD", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/invoices/generate-from-pod")
        .set("Authorization", `Bearer ${org.accountsToken}`)
        .send({ podId })
        .expect(HttpStatus.CONFLICT);
    });

    it("verifies sequential approval stages copied from customer templates", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/invoices/${invoiceId}/stages`)
        .set("Authorization", `Bearer ${org.accountsToken}`)
        .expect(200);

      expect(res.body.length).toBe(2);
      expect(res.body[0].name).toBe("Operations Verification");
      expect(res.body[0].sequence).toBe(1);
      expect(res.body[0].status).toBe("ACTIVE");
      expect(res.body[1].name).toBe("Finance Signoff");
      expect(res.body[1].sequence).toBe(2);
      expect(res.body[1].status).toBe("PENDING");
    });
  });

  describe("Step 7: Multi-Stage Approval Workflow & CRM Follow-Up", () => {
    let stage1Id: string;
    let stage2Id: string;

    it("fetches stages and approves Stage 1", async () => {
      const stagesRes = await request(app.getHttpServer())
        .get(`/api/v1/invoices/${invoiceId}/stages`)
        .set("Authorization", `Bearer ${org.accountsToken}`)
        .expect(200);

      stage1Id = stagesRes.body[0].id;
      stage2Id = stagesRes.body[1].id;

      const approveRes = await request(app.getHttpServer())
        .post(`/api/v1/invoices/${invoiceId}/stages/${stage1Id}/approve`)
        .set("Authorization", `Bearer ${org.staffToken}`)
        .send({ remarks: "Operations checked and approved" })
        .expect(200);

      expect(approveRes.body[0].status).toBe("APPROVED");
      expect(approveRes.body[1].status).toBe("ACTIVE");
    });

    it("holds and releases Stage 2 before final signoff", async () => {
      // Hold Stage 2
      await request(app.getHttpServer())
        .post(`/api/v1/invoices/${invoiceId}/stages/${stage2Id}/hold`)
        .set("Authorization", `Bearer ${org.accountsToken}`)
        .send({ reason: "DISPUTED_LINE", remarks: "Verifying toll receipt" })
        .expect(200);

      // Release Stage 2 hold
      await request(app.getHttpServer())
        .post(`/api/v1/invoices/${invoiceId}/stages/${stage2Id}/release-hold`)
        .set("Authorization", `Bearer ${org.accountsToken}`)
        .send({ remarks: "Toll voucher verified with FASTag statement" })
        .expect(200);
    });

    it("approves Stage 2 -> invoice transitions to FULLY_APPROVED", async () => {
      const approveRes = await request(app.getHttpServer())
        .post(`/api/v1/invoices/${invoiceId}/stages/${stage2Id}/approve`)
        .set("Authorization", `Bearer ${org.accountsToken}`)
        .send({ remarks: "Finance audit complete" })
        .expect(200);

      expect(approveRes.body[1].status).toBe("APPROVED");

      const invoiceRes = await request(app.getHttpServer())
        .get(`/api/v1/invoices/${invoiceId}`)
        .set("Authorization", `Bearer ${org.accountsToken}`)
        .expect(200);

      expect(invoiceRes.body.status).toBe("FULLY_APPROVED");
      expect(invoiceRes.body.approvedAt).toBeDefined();
    });

    it("records a CRM follow-up touchpoint", async () => {
      const followUpRes = await request(app.getHttpServer())
        .post(`/api/v1/invoices/${invoiceId}/follow-ups`)
        .set("Authorization", `Bearer ${org.accountsToken}`)
        .send({
          outcome: "PROMISE_TO_PAY",
          contactPerson: "Ramesh Sharma (AP Lead)",
          remarks: "Spoke to AP lead; promised payment via bank transfer by tomorrow",
          nextFollowUpOn: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        })
        .expect(201);

      expect(followUpRes.body.id).toBeDefined();
      expect(followUpRes.body.outcome).toBe("PROMISE_TO_PAY");
      expect(followUpRes.body.contactPerson).toBe("Ramesh Sharma (AP Lead)");

      const listRes = await request(app.getHttpServer())
        .get(`/api/v1/invoices/${invoiceId}/follow-ups`)
        .set("Authorization", `Bearer ${org.accountsToken}`)
        .expect(200);

      expect(listRes.body.length).toBe(1);
    });
  });

  describe("Step 8: Payment Settlement & Financial Closure", () => {
    it("records full payment against FULLY_APPROVED invoice -> transitions to PAID", async () => {
      const paymentRes = await request(app.getHttpServer())
        .post(`/api/v1/invoices/${invoiceId}/payments`)
        .set("Authorization", `Bearer ${org.accountsToken}`)
        .send({
          amount: 3009000, // full payment in paise
          method: "BANK_TRANSFER",
          reference: "UTR-BANK-998877",
          paidAt: new Date().toISOString(),
        })
        .expect(200);

      expect(paymentRes.body.payment.id).toBeDefined();

      // Check invoice status is now PAID
      const invoiceRes = await request(app.getHttpServer())
        .get(`/api/v1/invoices/${invoiceId}`)
        .set("Authorization", `Bearer ${org.accountsToken}`)
        .expect(200);

      expect(invoiceRes.body.status).toBe("PAID");
    });
  });

  describe("Step 9: Control Tower Operational Dashboard Verification", () => {
    it("queries GET /api/v1/dashboard/summary and verifies all 5 operational metrics", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/dashboard/summary")
        .set("Authorization", `Bearer ${org.staffToken}`)
        .expect(200);

      expect(res.body.activeTrips).toBeDefined();
      expect(res.body.pendingPods).toBeDefined();
      expect(res.body.podsOnHold).toBeDefined();
      expect(res.body.originalPods).toBeDefined();
      expect(res.body.invoicesNeedingFollowUp).toBeDefined();
    });
  });
});
