import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Deleting ALL products, variants, images, collections...");

  await prisma.productImage.deleteMany({});
  await prisma.variant.deleteMany({});
  await prisma.productCollection.deleteMany({});
  await prisma.collection.deleteMany({});
  await prisma.product.deleteMany({});

  console.log("Database cleaned.");
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
