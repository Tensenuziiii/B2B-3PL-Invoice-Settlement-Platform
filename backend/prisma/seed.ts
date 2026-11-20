import { PrismaClient, Role, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ============================================================
  // 1. Organization (tenant root)
  // ============================================================
  const org = await prisma.organization.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Vecto Logistics',
      legalName: 'Vecto Logistics Pvt Ltd',
      gstin: '27AABCV1234F1Z5',
      pan: 'AABCV1234F',
      stateCode: '27',
      status: 'ACTIVE',
    },
  });
  console.log(`✓ Organization: ${org.name} (${org.id})`);

  // ============================================================
  // 2. Client
  // ============================================================
  const client = await prisma.client.upsert({
    where: {
      organizationId_code: {
        organizationId: org.id,
        code: 'METRO-WHOLESALE',
      },
    },
    update: {},
    create: {
      organizationId: org.id,
      name: 'Metro Cash & Carry',
      code: 'METRO-WHOLESALE',
      gstin: '29AABCM1234F1Z2',
      stateCode: '29',
      paymentTermsDays: 30,
    },
  });
  console.log(`✓ Client: ${client.name}`);

  // ============================================================
  // 3. Users (one per role)
  // ============================================================
  const demoPassword = process.env.DEMO_PASSWORD ?? 'Enterprise@2026';
  const passwordHash = await argon2.hash(demoPassword);

  const users: Array<{ email: string; name: string; role: Role; displayId: string; hubName?: string; clientId?: string }> = [
    { email: 'admin@vectologistics.in',      name: 'Admin User',     role: Role.ADMIN,            displayId: 'ADM-01' },
    { email: 'dispatch@vectologistics.in',   name: 'Dispatch Lead',  role: Role.DISPATCH_MANAGER, displayId: 'DSP-01', hubName: 'Bhiwandi Hub #4' },
    { email: 'driver.rajesh@vectologistics.in', name: 'Rajesh Kumar', role: Role.DRIVER,          displayId: 'DRV-01' },
    { email: 'audit.lead@vectologistics.in', name: 'Audit Lead',     role: Role.AUDITOR,          displayId: 'AUD-01' },
    { email: 'billing.finance@vectologistics.in', name: 'Billing Lead', role: Role.ACCOUNTS,      displayId: 'ACC-01' },
    { email: 'ap.payments@metro-wholesale.in', name: 'Metro AP Team', role: Role.CLIENT_AP,       displayId: 'CAP-01', clientId: client.id },
    { email: 'partner@3pl-vendor.in',        name: '3PL Partner',    role: Role.VENDOR_3PL,       displayId: 'VND-01' },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        organizationId: org.id,
        email: u.email,
        name: u.name,
        initials: u.name.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase(),
        passwordHash,
        role: u.role,
        status: UserStatus.ACTIVE,
        displayId: u.displayId,
        hubName: u.hubName ?? null,
        clientId: u.clientId ?? null,
      },
    });
  }
  console.log(`✓ Users: ${users.length} created (password: ${demoPassword})`);

  // ============================================================
  // 4. Vehicle
  // ============================================================
  const vehicle = await prisma.vehicle.upsert({
    where: {
      organizationId_regNo: {
        organizationId: org.id,
        regNo: 'MH 12 RN 4920',
      },
    },
    update: {},
    create: {
      organizationId: org.id,
      regNo: 'MH 12 RN 4920',
      currentOdometer: 142380,
      active: true,
    },
  });
  console.log(`✓ Vehicle: ${vehicle.regNo}`);

  // ============================================================
  // 5. Driver profile
  // ============================================================
  const driverUser = await prisma.user.findFirst({
    where: { organizationId: org.id, email: 'driver.rajesh@vectologistics.in' },
  });

  if (driverUser) {
    const existingDriver = await prisma.driver.findFirst({
      where: { organizationId: org.id, userId: driverUser.id },
    });

    if (!existingDriver) {
      await prisma.driver.create({
        data: {
          organizationId: org.id,
          name: 'Rajesh Kumar',
          phone: '+919800000001',
          userId: driverUser.id,
          dutyStatus: 'OFFLINE',
        },
      });
      console.log('✓ Driver: Rajesh Kumar');
    }
  }

  // ============================================================
  // 6. Permissions + Role → Permission mappings
  // ============================================================
  const permissions = [
    // Identity
    { code: "users:read",         category: "identity", description: "View users" },
    { code: "users:create",       category: "identity", description: "Create users" },
    { code: "users:update",       category: "identity", description: "Update users" },
    { code: "users:deactivate",   category: "identity", description: "Deactivate users" },
    { code: "roles:read",         category: "identity", description: "View roles and permissions" },
    { code: "invitations:create", category: "identity", description: "Send invitations" },

    // Master data
    { code: "vehicles:manage",    category: "master", description: "Manage vehicles" },
    { code: "drivers:manage",     category: "master", description: "Manage drivers" },
    { code: "clients:manage",     category: "master", description: "Manage clients" },
    { code: "vendors:manage",     category: "master", description: "Manage vendors" },
    { code: "routes:manage",      category: "master", description: "Manage routes" },
    { code: "rate_cards:manage",  category: "master", description: "Manage rate cards" },

    // Trips
    { code: "trips:read",           category: "trips", description: "View trips" },
    { code: "trips:create",         category: "trips", description: "Create trips" },
    { code: "trips:assign",         category: "trips", description: "Assign driver/vehicle" },
    { code: "trips:update_status",  category: "trips", description: "Update trip status" },
    { code: "pods:upload",          category: "trips", description: "Upload POD" },
    { code: "collections:record",   category: "trips", description: "Record collections" },
    { code: "expenses:record",      category: "trips", description: "Record expenses" },
    { code: "eod:close",            category: "trips", description: "Close EOD" },

    // Audit
    { code: "audits:read",    category: "audit", description: "View audit queue" },
    { code: "audits:review",  category: "audit", description: "Approve or request correction" },

    // Invoices
    { code: "invoices:read",     category: "invoices", description: "View invoices" },
    { code: "invoices:create",   category: "invoices", description: "Generate invoices" },
    { code: "invoices:approve",  category: "invoices", description: "Approve invoices (client)" },
    { code: "disputes:create",   category: "invoices", description: "Raise disputes" },
    { code: "disputes:resolve",  category: "invoices", description: "Resolve disputes" },
    { code: "payments:record",   category: "invoices", description: "Record payments" },

    // Settlements
    { code: "settlements:read",   category: "settlements", description: "View settlements" },
    { code: "settlements:create", category: "settlements", description: "Create settlements" },

    // Notifications
    { code: "notifications:read", category: "notifications", description: "Read notifications" },
  ];

  for (const p of permissions) {
    await prisma.permission.upsert({
      where: { code: p.code },
      update: {},
      create: p,
    });
  }
  console.log(`✓ Permissions: ${permissions.length} seeded`);

  const rolePermissionMap: Record<Role, string[]> = {
    ADMIN: permissions.map((p) => p.code),

    STAFF: [
      "trips:read", "trips:create", "trips:assign", "trips:update_status",
      "pods:upload", "collections:record", "expenses:record", "eod:close",
      "vehicles:manage", "drivers:manage", "routes:manage", "clients:manage",
      "vendors:manage", "rate_cards:manage", "audits:read", "audits:review",
      "invoices:read", "invoices:create", "payments:record", "settlements:read",
      "settlements:create", "notifications:read",
    ],

    VIEWER: [
      "trips:read", "invoices:read", "audits:read", "settlements:read", "notifications:read",
    ],

    DISPATCH_MANAGER: [
      "trips:read", "trips:create", "trips:assign", "trips:update_status",
      "pods:upload", "collections:record", "expenses:record", "eod:close",
      "vehicles:manage", "drivers:manage", "routes:manage", "clients:manage",
      "notifications:read",
    ],

    DRIVER: [
      "trips:read", "trips:update_status", "pods:upload",
      "collections:record", "notifications:read",
    ],

    AUDITOR: [
      "trips:read", "audits:read", "audits:review", "pods:upload",
      "notifications:read",
    ],

    ACCOUNTS: [
      "invoices:read", "invoices:create", "disputes:resolve",
      "payments:record", "rate_cards:manage",
      "settlements:create", "settlements:read",
      "trips:read", "clients:manage", "notifications:read",
    ],

    CLIENT_AP: [
      "invoices:read", "invoices:approve", "disputes:create",
      "notifications:read",
    ],

    VENDOR_3PL: [
      "settlements:read", "notifications:read",
    ],
  };

  for (const [role, codes] of Object.entries(rolePermissionMap)) {
    for (const code of codes) {
      const perm = await prisma.permission.findUnique({ where: { code } });
      if (!perm) continue;
      await prisma.rolePermission.upsert({
        where: { role_permissionId: { role: role as Role, permissionId: perm.id } },
        update: {},
        create: { role: role as Role, permissionId: perm.id },
      });
    }
  }
  
  console.log(`✓ Role permissions mapped for ${Object.keys(rolePermissionMap).length} roles`);

  // ============================================================
  // 7. Sample rate card
  // ============================================================
  const existingRateCard = await prisma.rateCard.findFirst({
    where: { organizationId: org.id, name: "METRO-STD-2026" },
  });

  if (!existingRateCard) {
    await prisma.rateCard.create({
      data: {
        organizationId: org.id,
        name: "METRO-STD-2026",
        counterpartyType: "CLIENT",
        clientId: client.id,
        validFrom: new Date("2026-04-01"),
        validTo: null,
        status: "ACTIVE",
        notes: "Standard FY26 rate card for Metro Cash & Carry",
        items: {
          create: [
            { organizationId: org.id, rateType: "FIXED_TRIP", rate: 2500000, tripType: "FTL" },           // ₹25,000
            { organizationId: org.id, rateType: "PER_DELIVERY", rate: 150000, tripType: "PTL" },          // ₹1,500
            { organizationId: org.id, rateType: "PER_KM", rate: 5500, tripType: "FTL", serviceType: "STANDARD" }, // ₹55/km
          ],
        },
      },
    });
    console.log("✓ Rate card: METRO-STD-2026 with 3 items");
  }

  console.log('\n✨ Seed complete.\n');
  console.log('Login credentials (password for all users):');
  console.log(`  Password: ${demoPassword}`);
  console.log('  Admin:    admin@vectologistics.in');
  console.log('  Dispatch: dispatch@vectologistics.in');
  console.log('  Driver:   driver.rajesh@vectologistics.in');
  console.log('  Auditor:  audit.lead@vectologistics.in');
  console.log('  Accounts: billing.finance@vectologistics.in');
  console.log('  Client:   ap.payments@metro-wholesale.in');
  console.log('  Vendor:   partner@3pl-vendor.in');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });