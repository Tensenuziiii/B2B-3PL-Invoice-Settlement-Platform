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
      where: {
        organizationId_email: {
          organizationId: org.id,
          email: u.email,
        },
      },
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