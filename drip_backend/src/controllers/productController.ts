import { Request, Response } from "express";
import prisma from "../prisma";

/* =========================
   Helpers
========================= */

function isNonEmptyString(v: any): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function toNumber(v: any): number | null {
  if (v == null) return null;
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n) ? Number(n) : null;
}

function toInt(v: any): number | null {
  const n = toNumber(v);
  if (n == null) return null;
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function arrStrings(v: any): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map(String)
    .map((s) => s.trim())
    .filter(Boolean);
}

function arrNumbers(v: any): number[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => Number(x)).filter((n) => Number.isFinite(n));
}

/* =========================
   Shop DTO
========================= */

function toProductDto(p: any, collectionHandleOverride?: string) {
  const variants = p.variants ?? [];
  const firstVariant = variants[0];

  const price =
    firstVariant && firstVariant.price != null ? Number(firstVariant.price) : 0;

  const compareAtPrice =
    firstVariant && firstVariant.compareAtPrice != null
      ? Number(firstVariant.compareAtPrice)
      : null;

  const stock =
    variants.length > 0
      ? variants.reduce((sum: number, v: any) => {
          const q =
            typeof v.inventoryQuantity === "number"
              ? v.inventoryQuantity
              : Number(v.inventoryQuantity);
          return sum + (Number.isFinite(q) ? q : 0);
        }, 0)
      : 0; // ✅ better than 999 for shop

  const collectionHandle =
    collectionHandleOverride ?? p.collections?.[0]?.collection?.handle ?? "";

  const sizes: string[] = Array.from(
    new Set(
      variants
        .map((v: any) => v.option1 as string | null | undefined)
        .filter(Boolean),
    ),
  ) as string[];

  const colors: string[] = Array.from(
    new Set(
      variants
        .map((v: any) => v.option2 as string | null | undefined)
        .filter(Boolean),
    ),
  ) as string[];

  return {
    id: p.id,
    handle: p.handle,
    title: p.title,

    mainImage: p.images?.[0]?.src ?? "",
    images: (p.images ?? []).map((img: any) => img.src),

    price,
    compareAtPrice,
    isNew: false,
    isOnSale: compareAtPrice != null && compareAtPrice > price,

    brand: p.vendor ?? "",
    description: p.descriptionHtml ?? "",
    collection: collectionHandle,

    option1Name: p.option1Name ?? null,
    option2Name: p.option2Name ?? null,
    option3Name: p.option3Name ?? null,

    colors,
    sizes,
    stock,
  };
}

/* =========================
   SHOP: GET /api/products
========================= */

export async function getProducts(req: Request, res: Response) {
  try {
    const { search } = req.query as { search?: string };

    const productsRaw = await prisma.product.findMany({
      where: search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" } },
              { vendor: { contains: search, mode: "insensitive" } },
              { tags: { has: search } },
            ],
          }
        : undefined,
      include: {
        images: true,
        variants: true,
        collections: { include: { collection: true } },
      },
      take: 50,
    });

    res.json(productsRaw.map((p: any) => toProductDto(p)));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function getProductById(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "ID invalide" });

    const p = await prisma.product.findUnique({
      where: { id },
      include: {
        images: true,
        variants: true,
        collections: { include: { collection: true } },
      },
    });

    if (!p) return res.status(404).json({ error: "Produit non trouvé" });

    res.json(toProductDto(p));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function getProductByHandle(req: Request, res: Response) {
  try {
    const { handle } = req.params;

    const p = await prisma.product.findUnique({
      where: { handle },
      include: {
        images: true,
        variants: true,
        collections: { include: { collection: true } },
      },
    });

    if (!p) return res.status(404).json({ error: "Produit non trouvé" });

    res.json(toProductDto(p));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

/* =========================
   ADMIN: GET /api/admin/products
========================= */

export async function adminGetProducts(req: Request, res: Response) {
  try {
    const { search } = req.query as { search?: string };

    const products = await prisma.product.findMany({
      where: search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" } },
              { vendor: { contains: search, mode: "insensitive" } },
              { tags: { has: search } },
            ],
          }
        : undefined,
      include: {
        images: true,
        variants: true,
        collections: { include: { collection: true } },
      },
      orderBy: { id: "asc" },
    });

    const mapped = products.map((p) => ({
      ...p,
      collections: p.collections.map((pc) => ({
        id: pc.collection.id,
        handle: pc.collection.handle,
        title: pc.collection.title,
        productsCount: 0,
        description: pc.collection.description ?? undefined,
      })),
    }));

    res.json(mapped);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur (admin products)" });
  }
}

export async function adminGetProductById(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "ID invalide" });

    const p = await prisma.product.findUnique({
      where: { id },
      include: {
        images: true,
        variants: true,
        collections: { include: { collection: true } },
      },
    });

    if (!p) return res.status(404).json({ error: "Produit non trouvé" });

    const product = {
      ...p,
      collections: p.collections.map((pc) => ({
        id: pc.collection.id,
        handle: pc.collection.handle,
        title: pc.collection.title,
        productsCount: 0,
        description: pc.collection.description ?? undefined,
      })),
    };

    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur (admin product)" });
  }
}

/* =========================
   ADMIN: POST /api/admin/products
   ✅ Create product + default variant (price required)
========================= */

export async function adminCreateProduct(req: Request, res: Response) {
  try {
    const body = req.body as any;

    if (!isNonEmptyString(body?.title) || !isNonEmptyString(body?.handle)) {
      return res.status(400).json({ error: "title & handle are required" });
    }

    // ✅ price required for orders
    const price = toNumber(body.price);
    if (price == null || price <= 0) {
      return res
        .status(400)
        .json({ error: "price is required and must be > 0" });
    }

    const compareAtPrice = toNumber(body.compareAtPrice);
    const inventoryQuantity = toInt(body.inventoryQuantity);
    const sku = isNonEmptyString(body.sku) ? body.sku.trim() : null;

    const images = arrStrings(body.images);
    const collectionIds = arrNumbers(body.collectionIds);

    const created = await prisma.product.create({
      data: {
        title: body.title.trim(),
        handle: body.handle.trim(),

        vendor: isNonEmptyString(body.vendor) ? body.vendor.trim() : null,
        descriptionHtml: isNonEmptyString(body.descriptionHtml)
          ? body.descriptionHtml
          : null,
        status: body.status ?? null,
        tags: Array.isArray(body.tags) ? arrStrings(body.tags) : [],

        productType: body.productType ?? null,
        option1Name: body.option1Name ?? null,
        option2Name: body.option2Name ?? null,
        option3Name: body.option3Name ?? null,

        // ✅ default variant
        variants: {
          create: [
            {
              title: "Default",
              price,
              compareAtPrice: compareAtPrice ?? null,
              inventoryQuantity: inventoryQuantity ?? 999,
              sku,
              option1: body.option1 ?? null,
              option2: body.option2 ?? null,
              option3: body.option3 ?? null,
            },
          ],
        },

        images: images.length
          ? {
              create: images.map((src: string, idx: number) => ({
                src,
                position: idx + 1,
              })),
            }
          : undefined,

        collections: collectionIds.length
          ? {
              create: collectionIds.map((collectionId: number) => ({
                collectionId,
              })),
            }
          : undefined,
      },
      include: {
        images: true,
        variants: true,
        collections: { include: { collection: true } },
      },
    });

    return res.status(201).json(created);
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: "Erreur serveur (create product)" });
  }
}

/* =========================
   ADMIN: PATCH /api/admin/products/:id
   ✅ Update product + replace images
========================= */

export async function adminUpdateProduct(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

    const body = req.body as any;

    const replaceImages = Array.isArray(body.images)
      ? arrStrings(body.images)
      : undefined;

    if (replaceImages) {
      await prisma.productImage.deleteMany({ where: { productId: id } });
      if (replaceImages.length) {
        await prisma.productImage.createMany({
          data: replaceImages.map((src: string, idx: number) => ({
            src,
            position: idx + 1,
            productId: id,
          })),
        });
      }
    }

    const updated = await prisma.product.update({
      where: { id },
      data: {
        title: body.title ?? undefined,
        handle: body.handle ?? undefined,
        vendor: body.vendor ?? undefined,
        descriptionHtml: body.descriptionHtml ?? undefined,
        productType: body.productType ?? undefined,
        status: body.status ?? undefined,
        tags: body.tags ?? undefined,

        // ✅ option names
        option1Name: body.option1Name ?? undefined,
        option2Name: body.option2Name ?? undefined,
        option3Name: body.option3Name ?? undefined,
      },
      include: {
        images: true,
        collections: { include: { collection: true } },
        variants: true,
      },
    });

    return res.json(updated);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erreur serveur (update product)" });
  }
}

/* =========================
   ADMIN: PATCH /api/admin/products/:id/default-variant
   ✅ Update price/stock/sku safely
========================= */

export async function adminUpdateDefaultVariant(req: Request, res: Response) {
  try {
    const productId = Number(req.params.id);
    if (isNaN(productId)) return res.status(400).json({ error: "Invalid id" });

    const body = req.body as any;

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { variants: true },
    });
    if (!product) return res.status(404).json({ error: "Product not found" });

    const first = product.variants[0];

    const price = toNumber(body.price);
    const compareAtPrice =
      body.compareAtPrice === null ? null : toNumber(body.compareAtPrice);
    const inventoryQuantity =
      body.inventoryQuantity === null ? null : toInt(body.inventoryQuantity);
    const sku = isNonEmptyString(body.sku) ? body.sku.trim() : undefined;

    // if they send price, validate it
    if (body.price != null && (price == null || price <= 0)) {
      return res.status(400).json({ error: "price must be a number > 0" });
    }

    const data = {
      price: body.price != null ? price! : undefined,
      compareAtPrice: body.compareAtPrice != null ? compareAtPrice : undefined,
      inventoryQuantity:
        body.inventoryQuantity != null ? (inventoryQuantity ?? 0) : undefined,
      sku,
    };

    const v = first
      ? await prisma.variant.update({ where: { id: first.id }, data })
      : await prisma.variant.create({
          data: {
            title: "Default",
            productId,
            price: price ?? 0,
            compareAtPrice: compareAtPrice ?? null,
            inventoryQuantity: inventoryQuantity ?? 999,
            sku: isNonEmptyString(body.sku) ? body.sku.trim() : null,
          },
        });

    return res.json(v);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erreur serveur (update variant)" });
  }
}

/* =========================
   ADMIN: DELETE /api/admin/products/:id
========================= */

export async function adminDeleteProduct(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

    await prisma.productCollection.deleteMany({ where: { productId: id } });
    await prisma.product.delete({ where: { id } });

    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erreur serveur (delete product)" });
  }
}

/* =========================
   ADMIN: PUT /api/admin/products/:id/collections
========================= */

export async function adminSetProductCollections(req: Request, res: Response) {
  try {
    const productId = Number(req.params.id);
    if (isNaN(productId)) return res.status(400).json({ error: "Invalid id" });

    const { collectionIds } = req.body as { collectionIds: number[] };
    if (!Array.isArray(collectionIds)) {
      return res.status(400).json({ error: "collectionIds must be an array" });
    }

    await prisma.productCollection.deleteMany({ where: { productId } });

    if (collectionIds.length) {
      await prisma.productCollection.createMany({
        data: collectionIds.map((collectionId) => ({
          productId,
          collectionId,
        })),
        skipDuplicates: true,
      });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ error: "Erreur serveur (set product collections)" });
  }
}
