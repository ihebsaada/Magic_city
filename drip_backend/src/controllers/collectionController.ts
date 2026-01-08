import { Request, Response } from "express";
import prisma from "../prisma";

// petit helper pour transformer le modèle Prisma en Product pour le front
function toProductDto(p: any, collectionHandleOverride?: string) {
  const firstVariant = p.variants?.[0];

  const price =
    firstVariant && firstVariant.price != null ? Number(firstVariant.price) : 0;

  const compareAtPrice =
    firstVariant && firstVariant.compareAtPrice != null
      ? Number(firstVariant.compareAtPrice)
      : null;

  const stock =
    firstVariant && typeof firstVariant.inventoryQuantity === "number"
      ? firstVariant.inventoryQuantity
      : 0;

  const collectionHandle =
    collectionHandleOverride ?? p.collections?.[0]?.collection?.handle ?? "";

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
    colors: [] as string[],
    sizes: [] as string[],
    stock,
  };
}

// GET /api/collections
export async function getCollections(req: Request, res: Response) {
  try {
    const collections = await prisma.collection.findMany({
      orderBy: { title: "asc" },
      include: {
        _count: {
          select: { products: true }, // nb de ProductCollection liés
        },
      },
    });

    const data = collections.map((c: any) => ({
      id: c.id,
      handle: c.handle,
      title: c.title,
      productsCount: c._count.products,
    }));

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

// GET /api/collections/:handle/products?vendor=Gucci
export async function getCollectionProducts(req: Request, res: Response) {
  try {
    const { handle } = req.params;
    const { vendor } = req.query as { vendor?: string };

    const collection = await prisma.collection.findUnique({
      where: { handle },
      include: {
        products: {
          include: {
            product: {
              include: {
                images: true,
                variants: true,
                // si tu veux connaître les autres collections du produit :
                collections: {
                  include: { collection: true },
                },
              },
            },
          },
        },
      },
    });

    if (!collection) {
      return res.status(404).json({ error: "Collection non trouvée" });
    }

    // on mappe vers le format Product attendu par le front
    let products = collection.products.map((pc: any) =>
      toProductDto(pc.product, handle)
    );

    if (vendor) {
      products = products.filter((p: any) => p.brand === vendor);
    }

    res.json({
      collection: {
        id: collection.id,
        handle: collection.handle,
        title: collection.title,
      },
      products,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

// GET /api/collections/:handle/brands
export async function getCollectionBrands(req: Request, res: Response) {
  try {
    const { handle } = req.params;

    const products = await prisma.product.findMany({
      where: {
        collections: {
          some: {
            collection: { handle },
          },
        },
        vendor: { not: null },
      },
      select: { vendor: true },
    });

    const counts = new Map<string, number>();

    for (const p of products) {
      if (!p.vendor) continue;
      counts.set(p.vendor, (counts.get(p.vendor) ?? 0) + 1);
    }

    const result = Array.from(counts.entries())
      .map(([vendor, count]) => ({ vendor, count }))
      .sort((a, b) => b.count - a.count);

    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error fetching collection brands" });
  }
}

// ADMIN: GET /api/admin/collections
export async function adminGetCollections(req: Request, res: Response) {
  try {
    const collections = await prisma.collection.findMany({
      include: {
        products: true,
      },
      orderBy: { id: "asc" },
    });

    const mapped = collections.map((c) => ({
      id: c.id,
      handle: c.handle,
      title: c.title,
      description: c.description ?? undefined,
      productsCount: c.products.length,
    }));

    res.json(mapped);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur (admin collections)" });
  }
}

// ADMIN: GET /api/admin/collections/:handle
export async function adminGetCollectionWithProducts(
  req: Request,
  res: Response
) {
  try {
    const { handle } = req.params;

    const collection = await prisma.collection.findUnique({
      where: { handle },
      include: {
        products: {
          include: {
            product: {
              include: {
                images: true,
                variants: true,
                collections: {
                  include: { collection: true },
                },
              },
            },
          },
        },
      },
    });

    if (!collection) {
      return res.status(404).json({ error: "Collection non trouvée" });
    }

    const result = {
      collection: {
        id: collection.id,
        handle: collection.handle,
        title: collection.title,
        description: collection.description ?? undefined,
        productsCount: collection.products.length,
      },
      products: collection.products.map((pc) => {
        const p = pc.product;
        return {
          ...p,
          collections: p.collections.map((c) => ({
            id: c.collection.id,
            handle: c.collection.handle,
            title: c.collection.title,
            productsCount: 0,
            description: c.collection.description ?? undefined,
          })),
        };
      }),
    };

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur (admin collection detail)" });
  }
}
