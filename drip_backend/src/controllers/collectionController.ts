import {productReadSelect,toProductDto,productSearch,textQuery,validateTextQueryKeys,CatalogueInputError} from "../services/productRead";
import { Request, Response } from "express";
import prisma from "../prisma";

export async function getCollectionProducts(req:Request,res:Response) {
 try {validateTextQueryKeys(req.query);const handle=req.params.handle,vendor=textQuery(req.query.vendor,"vendor"),search=textQuery(req.query.search,"search");
 const collection=await prisma.collection.findUnique({where:{handle},select:{id:true,handle:true,title:true}});
 if(!collection)return res.status(404).json({error:"Collection non trouvée"});
 const products=await prisma.product.findMany({where:{collections:{some:{collectionId:collection.id}},...(vendor?{vendor}:{}),...productSearch(search)},orderBy:{id:"asc"},select:productReadSelect(true,false)});
 return res.json({collection,products:products.map(p=>toProductDto(p,handle))});
 }catch(error){if(error instanceof CatalogueInputError)return res.status(400).json({error:error.message});return res.status(500).json({error:"Erreur serveur"});}
}
export async function getCollectionBrands(req:Request,res:Response) {
 try {const groups=await prisma.product.groupBy({by:["vendor"],where:{collections:{some:{collection:{handle:req.params.handle}}},vendor:{not:null}},_count:{id:true},orderBy:{vendor:"asc"}});
 return res.json(groups.filter(p=>p.vendor).map(p=>({vendor:p.vendor,count:p._count.id})).sort((a,b)=>b.count-a.count));}
 catch{return res.status(500).json({error:"Error fetching collection brands"});}
}



export async function getCollections(_req:Request,res:Response){
 try{const rows=await prisma.collection.findMany({orderBy:{title:"asc"},select:{id:true,handle:true,title:true,_count:{select:{products:true}}}});
 return res.json(rows.map(c=>({id:c.id,handle:c.handle,title:c.title,productsCount:c._count.products})));}
 catch{return res.status(500).json({error:"Erreur serveur"});}
}

// ADMIN: GET /api/admin/collections
export async function adminGetCollections(req: Request, res: Response) {
  try {
    const collections = await prisma.collection.findMany({
      select: {id:true,handle:true,title:true,description:true,_count:{select:{products:true}}},
      orderBy: { id: "asc" },
    });

    const mapped = collections.map((c) => ({
      id: c.id,
      handle: c.handle,
      title: c.title,
      description: c.description ?? undefined,
      productsCount: c._count.products,
    }));

    res.json(mapped);
  } catch (err) {
    console.error("API operation failed");
    res.status(500).json({ error: "Erreur serveur (admin collections)" });
  }
}

// ADMIN: GET /api/admin/collections/:handle
export async function adminGetCollectionWithProducts(
  req: Request,
  res: Response,
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
                images: {orderBy:[{position:"asc"},{id:"asc"}]},
                variants: {orderBy:{id:"asc"}},
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
    console.error("API operation failed");
    res.status(500).json({ error: "Erreur serveur (admin collection detail)" });
  }
}

// ADMIN: POST /api/admin/collections
export async function adminCreateCollection(req: Request, res: Response) {
  try {
    const { title, handle, description } = req.body as {
      title: string;
      handle: string;
      description?: string;
    };

    if (!title || !handle) {
      return res.status(400).json({ error: "title & handle are required" });
    }

    const created = await prisma.collection.create({
      data: {
        title,
        handle,
        description: description ?? null,
      },
    });

    return res.status(201).json(created);
  } catch (err: any) {
    console.error("API operation failed");
    // handle unique constraint "handle"
    return res
      .status(500)
      .json({ error: "Erreur serveur (create collection)" });
  }
}
// ADMIN: PATCH /api/admin/collections/:id
export async function adminUpdateCollection(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

    const { title, handle, description } = req.body as {
      title?: string;
      handle?: string;
      description?: string | null;
    };

    const updated = await prisma.collection.update({
      where: { id },
      data: {
        title: title ?? undefined,
        handle: handle ?? undefined,
        description: description === undefined ? undefined : description,
      },
    });

    return res.json(updated);
  } catch (err) {
    console.error("API operation failed");
    return res
      .status(500)
      .json({ error: "Erreur serveur (update collection)" });
  }
}
// Assign product ↔ collection POST /api/admin/collections/:id/products
export async function adminAddProductToCollection(req: Request, res: Response) {
  try {
    const collectionId = Number(req.params.id);
    const { productId } = req.body as { productId: number };

    if (isNaN(collectionId) || !productId) {
      return res.status(400).json({ error: "Invalid data" });
    }

    const link = await prisma.productCollection.create({
      data: { collectionId, productId },
    });

    return res.status(201).json(link);
  } catch (err: any) {
    console.error("API operation failed");
    // Si déjà lié => unique composite @@id([productId, collectionId])
    return res.status(409).json({ error: "Already linked" });
  }
}

// DELETE /api/admin/collections/:id/products/:productId
export async function adminRemoveProductFromCollection(
  req: Request,
  res: Response,
) {
  try {
    const collectionId = Number(req.params.id);
    const productId = Number(req.params.productId);

    if (isNaN(collectionId) || isNaN(productId)) {
      return res.status(400).json({ error: "Invalid data" });
    }

    await prisma.productCollection.delete({
      where: { productId_collectionId: { productId, collectionId } },
    });

    return res.status(204).send();
  } catch (err) {
    console.error("API operation failed");
    return res.status(500).json({ error: "Erreur serveur (unlink product)" });
  }
}
// ADMIN: DELETE /api/admin/collections/:id
export async function adminDeleteCollection(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

    await prisma.productCollection.deleteMany({ where: { collectionId: id } });
    await prisma.collection.delete({ where: { id } });

    return res.status(204).send();
  } catch (err) {
    console.error("API operation failed");
    return res
      .status(500)
      .json({ error: "Erreur serveur (delete collection)" });
  }
}
