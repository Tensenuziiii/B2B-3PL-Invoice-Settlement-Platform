import { PrismaClient, Role } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const demoUsers = [
  {
    email: 'dispatch@vectologistics.in',
    name: 'Dispatch Manager',
    role: Role.DISPATCH_MANAGER,
    displayId: 'DIS-04',
  },
  {
    email: 'driver.rajesh@vectologistics.in',
    name: 'Rajesh Kumar',
    role: Role.DRIVER,
    displayId: 'DRV-18',
  },
  {
    email: 'audit.lead@vectologistics.in',
    name: 'Audit Lead',
    role: Role.AUDITOR,
    displayId: 'AUD-12',
  },
  {
    email: 'billing.finance@vectologistics.in',
    name: 'Finance Ops',
    role: Role.ACCOUNTS,
    displayId: 'ACC-07',
  },
  {
    email: 'ap.payments@metro-wholesale.in',
    name: 'Metro Finance Team',
    role: Role.CLIENT_AP,
    displayId: 'AP-IND-01',
  },
  {
    email: 'admin@vectologistics.in',
    name: 'Platform Administrator',
    role: Role.ADMIN,
    displayId: 'ADM-01',
  },
];

async function main() {
  const hub = await prisma.hub.upsert({
    where: { name: 'Western Corridor Hub #4 (Bhiwandi)' },
    update: {},
    create: {
      name: 'Western Corridor Hub #4 (Bhiwandi)',
      region: 'Western Corridor',
      city: 'Bhiwandi',
      stateCode: 'MH',
    },
  });

  const client = await prisma.client.upsert({
    where: { code: 'METRO-WHOLESALE' },
    update: {},
    create: {
      name: 'Metro Wholesale India',
      code: 'METRO-WHOLESALE',
      stateCode: 'MH',
      paymentTermsDays: 30,
    },
  });

  const passwordHash = await argon2.hash(
    process.env.DEMO_PASSWORD ?? 'Enterprise@2026',
  );

  for (const user of demoUsers) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: {
        ...user,
        passwordHash,
        initials: user.name
          .split(' ')
          .map((part) => part[0])
          .join('')
          .slice(0, 2)
          .toUpperCase(),
        hubName: hub.name,
        clientId: user.role === Role.CLIENT_AP ? client.id : undefined,
      },
    });
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });