const prisma_1={default:require("../../dist/prisma").default};
const reservations_1=require("../../dist/services/reservations");
function toProductDto(p, collectionHandleOverride) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
    const variants = (_a = p.variants) !== null && _a !== void 0 ? _a : [];
    const firstVariant = variants[0];
    const price = firstVariant && firstVariant.price != null ? Number(firstVariant.price) : 0;
    const compareAtPrice = firstVariant && firstVariant.compareAtPrice != null
        ? Number(firstVariant.compareAtPrice)
        : null;
    const stock = variants.length > 0
        ? variants.reduce((sum, v) => {
            var _a;
            const q = typeof v.inventoryQuantity === "number"
                ? v.inventoryQuantity
                : Number(v.inventoryQuantity);
            return sum + Math.max(0, (Number.isFinite(q) ? q : 0) - ((_a = v.reservedQuantity) !== null && _a !== void 0 ? _a : 0));
        }, 0)
        : 0; // ✅ better than 999 for shop
    const collectionHandle = (_e = collectionHandleOverride !== null && collectionHandleOverride !== void 0 ? collectionHandleOverride : (_d = (_c = (_b = p.collections) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.collection) === null || _d === void 0 ? void 0 : _d.handle) !== null && _e !== void 0 ? _e : "";
    const sizes = Array.from(new Set(variants
        .map((v) => v.option1)
        .filter(Boolean)));
    const colors = Array.from(new Set(variants
        .map((v) => v.option2)
        .filter(Boolean)));
    return {
        id: p.id,
        handle: p.handle,
        title: p.title,
        mainImage: (_h = (_g = (_f = p.images) === null || _f === void 0 ? void 0 : _f[0]) === null || _g === void 0 ? void 0 : _g.src) !== null && _h !== void 0 ? _h : "",
        images: ((_j = p.images) !== null && _j !== void 0 ? _j : []).map((img) => img.src),
        price,
        compareAtPrice,
        isNew: false,
        isOnSale: compareAtPrice != null && compareAtPrice > price,
        brand: (_k = p.vendor) !== null && _k !== void 0 ? _k : "",
        description: (_l = p.descriptionHtml) !== null && _l !== void 0 ? _l : "",
        collection: collectionHandle,
        option1Name: (_m = p.option1Name) !== null && _m !== void 0 ? _m : null,
        option2Name: (_o = p.option2Name) !== null && _o !== void 0 ? _o : null,
        option3Name: (_p = p.option3Name) !== null && _p !== void 0 ? _p : null,
        colors,
        sizes,
        stock,
    };
}
/* =========================
   SHOP: GET /api/products
========================= */
async function getProducts(req, res) {
    try {
        const { search } = req.query;
        // const productsRaw = await prisma.product.findMany({
        //   where: search
        //     ? {
        //         OR: [
        //           { title: { contains: search, mode: "insensitive" } },
        //           { vendor: { contains: search, mode: "insensitive" } },
        //           { tags: { has: search } },
        //         ],
        //       }
        //     : undefined,
        //   include: {
        //     images: true,
        //     variants: true,
        //     collections: { include: { collection: true } },
        //   },
        //   take: 50,
        // });
        const productsRaw = await prisma_1.default.product.findMany({
            take: 24, // 50 is heavy for homepage
            select: {
                id: true,
                handle: true,
                title: true,
                vendor: true,
                descriptionHtml: true,
                option1Name: true,
                option2Name: true,
                option3Name: true,
                images: {
                    select: { src: true },
                    take: 1, // ONLY first image
                    orderBy: { position: "asc" },
                },
                variants: {
                    select: {
                        price: true,
                        compareAtPrice: true,
                        inventoryQuantity: true,
                        reservedQuantity: true,
                        option1: true,
                        option2: true,
                    },
                },
                collections: {
                    select: {
                        collection: {
                            select: { handle: true },
                        },
                    },
                    take: 1,
                },
            },
        });
        res.json(productsRaw.map((p) => toProductDto(p)));
    }
    catch (err) {
        if (err instanceof reservations_1.ReservationError)
            return res.status(err.status).json({ error: err.code });
        console.error(err);
        res.status(500).json({ error: "Erreur serveur" });
    }
}
async function getProductById(req, res) {
    try {
        const id = Number(req.params.id);
        if (isNaN(id))
            return res.status(400).json({ error: "ID invalide" });
        const p = await prisma_1.default.product.findUnique({
            where: { id },
            include: {
                images: true,
                variants: true,
                collections: { include: { collection: true } },
            },
        });
        if (!p)
            return res.status(404).json({ error: "Produit non trouvé" });
        res.json(toProductDto(p));
    }
    catch (err) {
        if (err instanceof reservations_1.ReservationError)
            return res.status(err.status).json({ error: err.code });
        console.error(err);
        res.status(500).json({ error: "Erreur serveur" });
    }
}
async function getProductByHandle(req, res) {
    try {
        const { handle } = req.params;
        const p = await prisma_1.default.product.findUnique({
            where: { handle },
            include: {
                images: true,
                variants: true,
                collections: { include: { collection: true } },
            },
        });
        if (!p)
            return res.status(404).json({ error: "Produit non trouvé" });
        res.json(toProductDto(p));
    }
    catch (err) {
        if (err instanceof reservations_1.ReservationError)
            return res.status(err.status).json({ error: err.code });
        console.error(err);
        res.status(500).json({ error: "Erreur serveur" });
    }
}
/* =========================
   ADMIN: GET /api/admin/products
========================= */

module.exports={getProducts,getProductById,getProductByHandle};
