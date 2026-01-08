// src/scripts/import-shopify.ts
import "dotenv/config";
import fs from "fs";
import path from "path";
import { parse } from "csv-parse";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Typage basé sur TON export Shopify
type ShopifyRow = {
  Handle: string;
  Title: string;
  "Body (HTML)": string;
  Vendor: string;
  "Product Category": string;
  Type: string;
  Tags: string;
  Published: string;

  "Option1 Name": string;
  "Option1 Value": string;
  "Option1 Linked To": string;
  "Option2 Name": string;
  "Option2 Value": string;
  "Option2 Linked To": string;
  "Option3 Name": string;
  "Option3 Value": string;
  "Option3 Linked To": string;

  "Variant SKU": string;
  "Variant Grams": string;
  "Variant Inventory Tracker": string;
  "Variant Inventory Policy": string;
  "Variant Fulfillment Service": string;
  "Variant Price": string;
  "Variant Compare At Price": string;
  "Variant Requires Shipping": string;
  "Variant Taxable": string;

  "Variant Barcode": string;
  "Image Src": string;
  "Image Position": string;
  "Image Alt Text": string;

  "Variant Image": string;
  "Variant Weight Unit": string;
  "Variant Tax Code": string;
  "Cost per item": string;
  Status: string;
};

// Ce qu’on va stocker en mémoire avant d’envoyer à Prisma
type AggregatedProduct = {
  handle: string;
  title?: string;
  descriptionHtml?: string;
  vendor?: string;
  productType?: string;
  tags?: string[];
  status?: string;

  // 🔹 nouveaux champs
  option1Name?: string;
  option2Name?: string;
  option3Name?: string;

  images: {
    src: string;
    alt?: string;
    position?: number;
  }[];
  variants: {
    sku?: string;
    title?: string;
    price?: number;
    compareAtPrice?: number;
    option1?: string;
    option2?: string;
    option3?: string;
  }[];
};

// 🔹 Utilise maintenant le nouveau CSV exporté de Shopify
const csvPath = path.join(process.cwd(), "products_export_2.csv");

async function main() {
  if (!fs.existsSync(csvPath)) {
    console.error("CSV file not found at:", csvPath);
    process.exit(1);
  }

  console.log("Reading CSV:", csvPath);

  const fileContent = fs.readFileSync(csvPath, "utf-8");

  const records: ShopifyRow[] = await new Promise((resolve, reject) => {
    const rows: ShopifyRow[] = [];

    const parser = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
    });

    parser
      .on("readable", function (this: any) {
        let record;
        // eslint-disable-next-line no-cond-assign
        while ((record = this.read()) !== null) {
          rows.push(record as ShopifyRow);
        }
      })
      .on("error", (err) => reject(err))
      .on("end", () => resolve(rows));
  });

  console.log(`CSV chargé, lignes: ${records.length}`);

  // Regrouper par handle
  const productsMap = new Map<string, AggregatedProduct>();

  for (const row of records) {
    const handle = row.Handle;
    if (!handle) continue;

    let agg = productsMap.get(handle);
    if (!agg) {
      agg = {
        handle,
        images: [],
        variants: [],
      };
      productsMap.set(handle, agg);
    }

    // Infos produit (les mêmes sur toutes les lignes)
    if (row.Title) {
      agg.title = row.Title;
      agg.descriptionHtml = row["Body (HTML)"] || undefined;
      agg.vendor = row.Vendor || undefined;
      agg.productType = row.Type || undefined;
      agg.status = row.Status || undefined;
      agg.tags = row.Tags
        ? row.Tags.split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : [];
    }

    // 🔹 Enregistrer le nom des options (Size, Color, etc.)
    if (row["Option1 Name"]) agg.option1Name = row["Option1 Name"];
    if (row["Option2 Name"]) agg.option2Name = row["Option2 Name"];
    if (row["Option3 Name"]) agg.option3Name = row["Option3 Name"];

    // Image
    if (row["Image Src"]) {
      const position = row["Image Position"]
        ? parseInt(row["Image Position"], 10)
        : undefined;

      if (!agg.images.find((img) => img.src === row["Image Src"])) {
        agg.images.push({
          src: row["Image Src"],
          alt: row["Image Alt Text"] || undefined,
          position,
        });
      }
    }

    // Variante
    const hasVariant =
      row["Variant SKU"] ||
      row["Variant Price"] ||
      row["Option1 Value"] ||
      row["Option2 Value"] ||
      row["Option3 Value"];

    if (hasVariant) {
      const price = row["Variant Price"]
        ? parseFloat(row["Variant Price"])
        : undefined;
      const compareAtPrice = row["Variant Compare At Price"]
        ? parseFloat(row["Variant Compare At Price"])
        : undefined;

      const optionTitleParts: string[] = [];

      if (row["Option1 Name"] && row["Option1 Value"]) {
        optionTitleParts.push(
          `${row["Option1 Name"]}: ${row["Option1 Value"]}`
        );
      }
      if (row["Option2 Name"] && row["Option2 Value"]) {
        optionTitleParts.push(
          `${row["Option2 Name"]}: ${row["Option2 Value"]}`
        );
      }
      if (row["Option3 Name"] && row["Option3 Value"]) {
        optionTitleParts.push(
          `${row["Option3 Name"]}: ${row["Option3 Value"]}`
        );
      }

      agg.variants.push({
        sku: row["Variant SKU"] || undefined,
        title: optionTitleParts.join(" / ") || undefined,
        price,
        compareAtPrice,
        option1: row["Option1 Value"] || undefined,
        option2: row["Option2 Value"] || undefined,
        option3: row["Option3 Value"] || undefined,
      });
    }
  }

  console.log(`Produits distincts trouvés: ${productsMap.size}`);

  // 🔥 (OPTIONNEL) : supprimer les produits qui ne sont plus dans le CSV
  const handlesFromCsv = Array.from(productsMap.keys());
  await prisma.product.deleteMany({
    where: {
      handle: { notIn: handlesFromCsv },
    },
  });
  console.log("Produits supprimés s'ils n'existent plus dans le CSV.");

  // Upsert dans la base
  let count = 0;
  for (const [handle, agg] of productsMap.entries()) {
    if (!agg.title) {
      console.warn(`Produit ignoré (pas de title) pour handle: ${handle}`);
      continue;
    }

    await prisma.product.upsert({
      where: { handle },
      create: {
        handle,
        title: agg.title,
        descriptionHtml: agg.descriptionHtml,
        vendor: agg.vendor,
        productType: agg.productType,
        status: agg.status,
        tags: agg.tags || [],

        option1Name: agg.option1Name,
        option2Name: agg.option2Name,
        option3Name: agg.option3Name,

        images: {
          create: agg.images.map((img) => ({
            src: img.src,
            alt: img.alt,
            position: img.position,
          })),
        },
        variants: {
          create: agg.variants.map((v) => ({
            sku: v.sku,
            title: v.title,
            price: v.price != null ? v.price.toString() : undefined,
            compareAtPrice:
              v.compareAtPrice != null
                ? v.compareAtPrice.toString()
                : undefined,
            option1: v.option1,
            option2: v.option2,
            option3: v.option3,
          })),
        },
      },
      update: {
        title: agg.title,
        descriptionHtml: agg.descriptionHtml,
        vendor: agg.vendor,
        productType: agg.productType,
        status: agg.status,
        tags: agg.tags || [],

        option1Name: agg.option1Name,
        option2Name: agg.option2Name,
        option3Name: agg.option3Name,

        images: {
          deleteMany: {}, // on reset toutes les images
          create: agg.images.map((img) => ({
            src: img.src,
            alt: img.alt,
            position: img.position,
          })),
        },
        variants: {
          deleteMany: {}, // on recrée toutes les variantes
          create: agg.variants.map((v) => ({
            sku: v.sku,
            title: v.title,
            price: v.price != null ? v.price.toString() : undefined,
            compareAtPrice:
              v.compareAtPrice != null
                ? v.compareAtPrice.toString()
                : undefined,
            option1: v.option1,
            option2: v.option2,
            option3: v.option3,
          })),
        },
      },
    });

    count++;
    if (count % 50 === 0) {
      console.log(`Upserted ${count} products...`);
    }
  }

  console.log(`Import terminé. Produits upsertés: ${count}`);
}

main()
  .catch((e) => {
    console.error("Erreur pendant l’import:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
