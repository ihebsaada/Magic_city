import {productReadSelect,toProductDto,productSearch,textQuery,validateTextQueryKeys,CatalogueInputError} from "../services/productRead";
import { Request, Response } from "express";
import prisma from "../prisma";
import {stockValue,updateVariantStock} from "../services/adminInventory";
import {ReservationError} from "../services/reservations";

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

/* =========================
   SHOP: GET /api/products
========================= */

export async function getProducts(req:Request,res:Response) {
 try {validateTextQueryKeys(req.query);const search=textQuery(req.query.search,"search"),vendor=textQuery(req.query.vendor,"vendor");
 const products=await prisma.product.findMany({where:{...productSearch(search),...(vendor?{vendor}:{})},take:24,orderBy:{id:"asc"},select:productReadSelect(false)});
 return res.json(products.map(p=>toProductDto(p)));
 }catch(error){if(error instanceof CatalogueInputError)return res.status(400).json({error:error.message});return res.status(500).json({error:"Erreur serveur"});}
}
export async function getProductById(req:Request,res:Response) {
 const id=Number(req.params.id);if(!Number.isInteger(id)||id<1||id>2147483647)return res.status(400).json({error:"ID invalide"});
 try {const p=await prisma.product.findUnique({where:{id},select:productReadSelect(true)});if(!p)return res.status(404).json({error:"Produit non trouvé"});return res.json(toProductDto(p));}
 catch{return res.status(500).json({error:"Erreur serveur"});}
}
export async function getProductByHandle(req:Request,res:Response) {
 try {const p=await prisma.product.findUnique({where:{handle:req.params.handle},select:productReadSelect(true)});if(!p)return res.status(404).json({error:"Produit non trouvé"});return res.json(toProductDto(p));}
 catch{return res.status(500).json({error:"Erreur serveur"});}
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
        images: {orderBy:[{position:"asc"},{id:"asc"}]},
        variants: {orderBy:{id:"asc"}},
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
    if(err instanceof ReservationError)return res.status(err.status).json({error:err.code});
    console.error("API operation failed");
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
        images: {orderBy:[{position:"asc"},{id:"asc"}]},
        variants: {orderBy:{id:"asc"}},
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
    if(err instanceof ReservationError)return res.status(err.status).json({error:err.code});
    console.error("API operation failed");
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
    const inventoryQuantity = body.inventoryQuantity===undefined?0:stockValue(body.inventoryQuantity);
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
              inventoryQuantity: inventoryQuantity,
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
        images: {orderBy:[{position:"asc"},{id:"asc"}]},
        variants: {orderBy:{id:"asc"}},
        collections: { include: { collection: true } },
      },
    });

    return res.status(201).json(created);
  } catch (err: any) {
    if(err instanceof ReservationError)return res.status(err.status).json({error:err.code});
    console.error("API operation failed");
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
        images: {orderBy:[{position:"asc"},{id:"asc"}]},
        collections: { include: { collection: true } },
        variants: {orderBy:{id:"asc"}},
      },
    });

    return res.json(updated);
  } catch (err) {
    if(err instanceof ReservationError)return res.status(err.status).json({error:err.code});
    console.error("API operation failed");
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

    const v=await updateVariantStock(productId,req.body??{});

    return res.json(v);
  } catch (err) {
    if(err instanceof ReservationError)return res.status(err.status).json({error:err.code});
    console.error("API operation failed");
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

    await prisma.$transaction(async tx=>{
      await tx.$queryRawUnsafe('SELECT "id" FROM "Product" WHERE "id"=$1 FOR UPDATE',id);
      if(await tx.stockReservationItem.count({where:{variant:{productId:id}}}))
        throw new ReservationError(409,"PRODUCT_HAS_RESERVATION_HISTORY");
      await tx.productCollection.deleteMany({where:{productId:id}});
      await tx.product.delete({where:{id}});
    });

    return res.status(204).send();
  } catch (err) {
    if(err instanceof ReservationError)return res.status(err.status).json({error:err.code});
    console.error("API operation failed");
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
    if(err instanceof ReservationError)return res.status(err.status).json({error:err.code});
    console.error("API operation failed");
    return res
      .status(500)
      .json({ error: "Erreur serveur (set product collections)" });
  }
}
