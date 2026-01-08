// src/scripts/build-collections.ts
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD") // enlever accents
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function main() {
  console.log("🔍 Recherche des types de produits distincts...");

  const types = await prisma.product.findMany({
    where: { productType: { not: null } },
    distinct: ["productType"],
    select: { productType: true },
  });

  console.log(`Types trouvés: ${types.length}`);

  let totalLinks = 0;

  for (const t of types) {
    const title = t.productType!;
    const handle = slugify(title);

    const collection = await prisma.collection.upsert({
      where: { handle },
      update: {},
      create: { handle, title },
    });

    const products: { id: number }[] = await prisma.product.findMany({
      where: { productType: title },
      select: { id: true },
    });

    if (products.length === 0) continue;

    await prisma.productCollection.createMany({
      data: products.map((p) => ({
        productId: p.id,
        collectionId: collection.id,
      })),
      skipDuplicates: true,
    });

    totalLinks += products.length;
    console.log(
      `✅ Collection "${title}" (id=${collection.id}) liée à ${products.length} produits`
    );
  }

  console.log("--------------------------");
  console.log(`✅ Collections créées: ${types.length}`);
  console.log(`✅ Liens ProductCollection créés: ${totalLinks}`);
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
