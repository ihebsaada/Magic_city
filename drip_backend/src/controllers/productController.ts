import { Request, Response } from "express";
import prisma from "../prisma";

// Petit helper pour convertir Prisma → DTO utilisé par le front
function toProductDto(p: any, collectionHandleOverride?: string) {
  const variants = p.variants ?? [];
  const firstVariant = variants[0];

  // Prix
  const price =
    firstVariant && firstVariant.price != null ? Number(firstVariant.price) : 0;

  const compareAtPrice =
    firstVariant && firstVariant.compareAtPrice != null
      ? Number(firstVariant.compareAtPrice)
      : null;

  // Stock = somme des stocks de toutes les variantes (sinon 999 par défaut)
  const stock =
    variants.length > 0
      ? variants.reduce(
          (sum: number, v: any) =>
            sum +
            (typeof v.inventoryQuantity === "number" ? v.inventoryQuantity : 0),
          0,
        )
      : 999;

  // Collection (handle) – soit override, soit première collection liée
  const collectionHandle =
    collectionHandleOverride ?? p.collections?.[0]?.collection?.handle ?? "";

  // Tailles / couleurs dérivées des variantes Shopify
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

    // images
    mainImage: p.images?.[0]?.src ?? "",
    images: (p.images ?? []).map((img: any) => img.src),

    // prix
    price,
    compareAtPrice,
    isNew: false,
    isOnSale: compareAtPrice != null && compareAtPrice > price,

    // infos produit
    brand: p.vendor ?? "",
    description: p.descriptionHtml ?? "",
    collection: collectionHandle,

    // 🔹 nouveaux champs : NOMS des options venant de Shopify
    option1Name: p.option1Name ?? null, // ex: "Taglia" / "Size"
    option2Name: p.option2Name ?? null, // ex: "Colore" / "Color"
    option3Name: p.option3Name ?? null,

    // valeurs dérivées des variantes
    colors,
    sizes,
    stock,
  };
}

// GET /api/products?search=gucci
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
        collections: {
          include: { collection: true },
        },
      },
      take: 50,
    });

    const products = productsRaw.map((p: any) => toProductDto(p));

    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

// GET /api/products/:id
export async function getProductById(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "ID invalide" });

    const p = await prisma.product.findUnique({
      where: { id },
      include: {
        images: true,
        variants: true,
        collections: {
          include: { collection: true },
        },
      },
    });

    if (!p) return res.status(404).json({ error: "Produit non trouvé" });

    const product = toProductDto(p);
    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

// GET /api/products/handle/:handle
export async function getProductByHandle(req: Request, res: Response) {
  try {
    const { handle } = req.params;

    const p = await prisma.product.findUnique({
      where: { handle },
      include: {
        images: true,
        variants: true,
        collections: {
          include: { collection: true },
        },
      },
    });

    if (!p) {
      return res.status(404).json({ error: "Produit non trouvé" });
    }

    const product = toProductDto(p);
    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

// ADMIN: GET /api/admin/products
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
        collections: {
          include: { collection: true },
        },
      },
      orderBy: { id: "asc" },
    });

    // on “aplatit” la relation pivot pour obtenir Collection[]
    const mapped = products.map((p) => ({
      ...p,
      collections: p.collections.map((pc) => ({
        id: pc.collection.id,
        handle: pc.collection.handle,
        title: pc.collection.title,
        productsCount: 0, // pas utile ici, mais le type l’attend
        description: pc.collection.description ?? undefined,
      })),
    }));

    res.json(mapped);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur (admin products)" });
  }
}

// ADMIN: GET /api/admin/products/:id
export async function adminGetProductById(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "ID invalide" });

    const p = await prisma.product.findUnique({
      where: { id },
      include: {
        images: true,
        variants: true,
        collections: {
          include: { collection: true },
        },
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
// POST /api/admin/products
export async function adminCreateProduct(req: Request, res: Response) {
  try {
    const body = req.body as any;

    if (!body?.title || !body?.handle) {
      return res.status(400).json({ error: "title & handle are required" });
    }

    const created = await prisma.product.create({
      data: {
        title: body.title,
        handle: body.handle,
        vendor: body.vendor ?? null,
        descriptionHtml: body.descriptionHtml ?? null,
        tags: Array.isArray(body.tags) ? body.tags : [],
        status: body.status ?? null,

        images:
          Array.isArray(body.images) && body.images.length
            ? {
                create: body.images.map((src: string, idx: number) => ({
                  src,
                  position: idx + 1,
                })),
              }
            : undefined,

        collections:
          Array.isArray(body.collectionIds) && body.collectionIds.length
            ? {
                create: body.collectionIds.map((collectionId: number) => ({
                  collectionId,
                })),
              }
            : undefined,
      },
      include: {
        images: true,
        collections: { include: { collection: true } },
      },
    });

    return res.status(201).json(created);
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: "Erreur serveur (create product)" });
  }
}
// PATCH /api/admin/products/:id
export async function adminUpdateProduct(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

    const body = req.body as any;

    // si on veut remplacer les images: on deleteMany + create
    const replaceImages = Array.isArray(body.images) ? body.images : undefined;

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
      },
      include: {
        images: true,
        collections: { include: { collection: true } },
        variants: true, // on peut laisser, mais tu ignores côté admin UI
      },
    });

    return res.json(updated);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erreur serveur (update product)" });
  }
}
// DELETE /api/admin/products/:id
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
// Assign collections depuis le product PUT /api/admin/products/:id/collections
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
