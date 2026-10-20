import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding sample trips...");

  const org = await prisma.organization.findFirst({
    where: { name: "Vecto Logistics" },
  });
  if (!org) throw new Error("Organization not found. Run `npx prisma db seed` first.");

  const client = await prisma.client.findFirst({ where: { organizationId: org.id } });
  const driver = await prisma.driver.findFirst({ where: { organizationId: org.id } });
  const vehicle = await prisma.vehicle.findFirst({ where: { organizationId: org.id } });
  if (!client || !driver || !vehicle) {
    throw new Error("Client/driver/vehicle not found. Run `npx prisma db seed` first.");
  }

  // Clean any prior sample trips — children first, then parents
  // (TripStop has a FK to Trip; TripExpense, EodTally, etc. may too)
  await prisma.tripStop.deleteMany({
    where: {
      trip: {
        organizationId: org.id,
        tripNumber: { startsWith: "TRP-SAMPLE" },
      },
    },
  });

  await prisma.tripExpense.deleteMany({
    where: {
      trip: {
        organizationId: org.id,
        tripNumber: { startsWith: "TRP-SAMPLE" },
      },
    },
  });

  await prisma.eodTally.deleteMany({
    where: {
      trip: {
        organizationId: org.id,
        tripNumber: { startsWith: "TRP-SAMPLE" },
      },
    },
  });

  await prisma.auditReview.deleteMany({
    where: {
      trip: {
        organizationId: org.id,
        tripNumber: { startsWith: "TRP-SAMPLE" },
      },
    },
  });

  await prisma.podDocument.deleteMany({
    where: {
      tripStop: {
        trip: {
          organizationId: org.id,
          tripNumber: { startsWith: "TRP-SAMPLE" },
        },
      },
    },
  });

  await prisma.collection.deleteMany({
    where: {
      tripStop: {
        trip: {
          organizationId: org.id,
          tripNumber: { startsWith: "TRP-SAMPLE" },
        },
      },
    },
  });

  await prisma.trip.deleteMany({
    where: {
      organizationId: org.id,
      tripNumber: { startsWith: "TRP-SAMPLE" },
    },
  });

  const samples = [
    {
      number: "TRP-SAMPLE-01",
      status: "ASSIGNED" as const,
      odometerStart: 142380,
      odometerEnd: null as number | null,
    },
    {
      number: "TRP-SAMPLE-02",
      status: "AUDIT_PENDING" as const,
      odometerStart: 142400,
      odometerEnd: 142580,
    },
    {
      number: "TRP-SAMPLE-03",
      status: "READY_FOR_BILLING" as const,
      odometerStart: 142600,
      odometerEnd: 142820,
    },
  ];

  for (const s of samples) {
    const trip = await prisma.trip.create({
      data: {
        organizationId: org.id,
        tripNumber: s.number,
        status: s.status,
        clientId: client.id,
        driverId: driver.id,
        vehicleId: vehicle.id,
        origin: "Bhiwandi Hub",
        destination: "Whitefield RDC",
        odometerStart: s.odometerStart,
        odometerEnd: s.odometerEnd,
        assignedAt: new Date(),
        tripStops: {
          create: [
            {
              organizationId: org.id,
              sequence: 1,
              name: "Test Delivery Point A",
              address: "Whitefield, Bengaluru",
              expectedQty: 10,
              collectionType: "COD",
              expectedCollection: 5000000,
            },
            {
              organizationId: org.id,
              sequence: 2,
              name: "Test Delivery Point B",
              address: "Electronic City, Bengaluru",
              expectedQty: 5,
              collectionType: "COD",
              expectedCollection: 2500000,
            },
          ],
        },
      },
    });
    console.log(`✓ ${trip.tripNumber} (${trip.status})`);
  }

  console.log("\n✨ Sample trips seeded successfully");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
