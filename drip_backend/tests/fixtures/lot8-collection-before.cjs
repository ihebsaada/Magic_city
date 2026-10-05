const prisma_1={default:require("../../dist/prisma").default};
const reservations_1=require("../../dist/services/reservations");
function toProductDto(p, collectionHandleOverride) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
    const firstVariant = (_a = p.variants) === null || _a === void 0 ? void 0 : _a[0];
    const price = firstVariant && firstVariant.price != null ? Number(firstVariant.price) : 0;
    const compareAtPrice = firstVariant && firstVariant.compareAtPrice != null
        ? Number(firstVariant.compareAtPrice)
        : null;
    const stock = ((_b = p.variants) !== null && _b !== void 0 ? _b : []).reduce((sum, v) => { var _a, _b; return sum + Math.max(0, ((_a = v.inventoryQuantity) !== null && _a !== void 0 ? _a : 0) - ((_b = v.reservedQuantity) !== null && _b !== void 0 ? _b : 0)); }, 0);
    const collectionHandle = (_f = collectionHandleOverride !== null && collectionHandleOverride !== void 0 ? collectionHandleOverride : (_e = (_d = (_c = p.collections) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.collection) === null || _e === void 0 ? void 0 : _e.handle) !== null && _f !== void 0 ? _f : "";
    return {
        id: p.id,
        handle: p.handle,
        title: p.title,
        mainImage: (_j = (_h = (_g = p.images) === null || _g === void 0 ? void 0 : _g[0]) === null || _h === void 0 ? void 0 : _h.src) !== null && _j !== void 0 ? _j : "",
        images: ((_k = p.images) !== null && _k !== void 0 ? _k : []).map((img) => img.src),
        price,
        compareAtPrice,
        isNew: false,
        isOnSale: compareAtPrice != null && compareAtPrice > price,
        brand: (_l = p.vendor) !== null && _l !== void 0 ? _l : "",
        description: (_m = p.descriptionHtml) !== null && _m !== void 0 ? _m : "",
        collection: collectionHandle,
        colors: [],
        sizes: [],
        stock,
    };
}
// GET /api/collections
async function getCollections(req, res) {
    try {
        const collections = await prisma_1.default.collection.findMany({
            orderBy: { title: "asc" },
            include: {
                _count: {
                    select: { products: true }, // nb de ProductCollection liés
                },
            },
        });
        const data = collections.map((c) => ({
            id: c.id,
            handle: c.handle,
            title: c.title,
            productsCount: c._count.products,
        }));
        res.json(data);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erreur serveur" });
    }
}
// GET /api/collections/:handle/products?vendor=Gucci
async function getCollectionProducts(req, res) {
    try {
        const { handle } = req.params;
        const { vendor } = req.query;
        const collection = await prisma_1.default.collection.findUnique({
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
        let products = collection.products.map((pc) => toProductDto(pc.product, handle));
        if (vendor) {
            products = products.filter((p) => p.brand === vendor);
        }
        res.json({
            collection: {
                id: collection.id,
                handle: collection.handle,
                title: collection.title,
            },
            products,
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erreur serveur" });
    }
}
// GET /api/collections/:handle/brands
async function getCollectionBrands(req, res) {
    var _a;
    try {
        const { handle } = req.params;
        const products = await prisma_1.default.product.findMany({
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
        const counts = new Map();
        for (const p of products) {
            if (!p.vendor)
                continue;
            counts.set(p.vendor, ((_a = counts.get(p.vendor)) !== null && _a !== void 0 ? _a : 0) + 1);
        }
        const result = Array.from(counts.entries())
            .map(([vendor, count]) => ({ vendor, count }))
            .sort((a, b) => b.count - a.count);
        res.json(result);
    }
    catch (e) {
        console.error(e);
        res.status(500).json({ error: "Error fetching collection brands" });
    }
}
// ADMIN: GET /api/admin/collections
async function adminGetCollections(req, res) {
    try {
        const collections = await prisma_1.default.collection.findMany({
            include: {
                products: true,
            },
            orderBy: { id: "asc" },
        });
        const mapped = collections.map((c) => {
            var _a;
            return ({
                id: c.id,
                handle: c.handle,
                title: c.title,
                description: (_a = c.description) !== null && _a !== void 0 ? _a : undefined,
                productsCount: c.products.length,
            });
        });
        res.json(mapped);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erreur serveur (admin collections)" });
    }
}
// ADMIN: GET /api/admin/collections/:handle

module.exports={getCollections,getCollectionProducts,getCollectionBrands,adminGetCollections};
