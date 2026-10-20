import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🧹 Cleaning up test invoice...");

  const target = await prisma.invoice.findFirst({
    where: { invoiceNumber: "INV-202610-0001" },
    include: { lines: true },
  });

  if (!target) {
    console.log("No test invoice found — nothing to clean up");
    return;
  }

  await prisma.invoiceLine.deleteMany({ where: { invoiceId: target.id } });
  await prisma.invoice.delete({ where: { id: target.id } });

  // Reset the counter so the next invoice gets 0001 again
  await prisma.counter.updateMany({
    where: { entityType: "INVOICE", lastValue: { gt: 0 } },
    data: { lastValue: 0 },
  });

  console.log(`✓ Deleted invoice ${target.invoiceNumber}`);
  console.log("✓ Reset INVOICE counter for this period");
  console.log("✓ TRP-SAMPLE-03 is now unlocked for testing");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
