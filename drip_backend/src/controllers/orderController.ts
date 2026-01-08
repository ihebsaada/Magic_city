import { Request, Response } from "express";
import prisma from "../prisma";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: process.env.STRIPE_API_VERSION as Stripe.LatestApiVersion,
});

// === DISCOUNT LOGIC ===================================

type DiscountRule =
  | { type: "percent"; value: number } // ex: 10 => -10%
  | { type: "fixed"; value: number }; // ex: 5  => -5€

const DISCOUNT_CODES: Record<string, DiscountRule> = {
  MAGIC10: { type: "percent", value: 10 },
  MAGIC5: { type: "fixed", value: 5 },
  // ajoute d'autres codes ici
};

type ApplyDiscountResult = {
  originalTotal: number;
  discountAmount: number;
  total: number;
  appliedCode?: string; // code réellement appliqué (normalisé) si valide
};

function applyDiscount(
  subtotal: number,
  discountCode?: string
): ApplyDiscountResult {
  const raw = (discountCode ?? "").trim();

  if (!raw) {
    return {
      originalTotal: subtotal,
      discountAmount: 0,
      total: subtotal,
    };
  }

  const normalized = raw.toUpperCase();
  const rule = DISCOUNT_CODES[normalized];

  if (!rule) {
    // code inconnu => pas de remise
    return {
      originalTotal: subtotal,
      discountAmount: 0,
      total: subtotal,
    };
  }

  let discountAmount = 0;

  if (rule.type === "percent") {
    discountAmount = (subtotal * rule.value) / 100;
  } else {
    discountAmount = rule.value;
  }

  // ne jamais descendre sous 0
  const total = Math.max(subtotal - discountAmount, 0);

  return {
    originalTotal: subtotal,
    discountAmount,
    total,
    appliedCode: normalized, // ex: "MAGIC10"
  };
}
// ======================================================

export async function createStripeCheckout(req: Request, res: Response) {
  try {
    const { orderId } = req.body as { orderId: string };

    if (!orderId) return res.status(400).json({ error: "Missing orderId" });

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        total: true,
        customerEmail: true,
        paymentStatus: true,
      },
    });

    if (!order) return res.status(404).json({ error: "Order not found" });

    // if already paid, block
    if (order.paymentStatus === "PAID") {
      return res.status(409).json({ error: "Order already paid" });
    }

    const currency = (process.env.STRIPE_CURRENCY || "eur").toLowerCase();

    // Stripe needs cents
    const amountCents = Math.round(Number(order.total) * 100);
    if (!amountCents || amountCents < 50) {
      return res.status(400).json({ error: "Invalid order total" });
    }

    const successTemplate = process.env.STRIPE_SUCCESS_URL || "";
    const cancelTemplate = process.env.STRIPE_CANCEL_URL || "";

    if (!successTemplate || !cancelTemplate) {
      return res
        .status(500)
        .json({ error: "Stripe success/cancel URLs not configured" });
    }

    const success_url = successTemplate.replace("{ORDER_ID}", order.id);
    const cancel_url = cancelTemplate.replace("{ORDER_ID}", order.id);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url,
      cancel_url,

      // ✅ MINIMUM INFO: 1 line item with total
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency,
            unit_amount: amountCents,
            product_data: {
              name: `Magic City Drip Order ${order.orderNumber ?? ""}`.trim(),
            },
          },
        },
      ],

      // ✅ Reference only (no product details)
      metadata: { order_id: order.id },

      // optional: helps Stripe receipts; not mandatory
      customer_email: order.customerEmail,
    });

    // Store session id (optional but recommended)
    await prisma.order.update({
      where: { id: order.id },
      data: {
        stripeSessionId: session.id, // only if field exists (see note below)
      },
    });

    return res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ error: "Erreur serveur (createStripeCheckout)" });
  }
}

function pickVariant(p: any, selectedSize?: string, selectedColor?: string) {
  const variants = p.variants ?? [];

  // Your convention: option1=size, option2=color (from productController)
  const match = variants.find((v: any) => {
    const okSize = selectedSize ? v.option1 === selectedSize : true;
    const okColor = selectedColor ? v.option2 === selectedColor : true;
    return okSize && okColor;
  });

  return match ?? variants[0] ?? null;
}

// GET /api/pay/confirm?session_id=cs_test_...
export async function confirmStripePayment(req: Request, res: Response) {
  try {
    const sessionId = String(req.query.session_id || "");
    if (!sessionId)
      return res.status(400).json({ error: "Missing session_id" });

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    const orderId = session.metadata?.order_id;
    if (!orderId) {
      return res
        .status(400)
        .json({ error: "Missing order_id in session metadata" });
    }

    if (session.payment_status !== "paid") {
      return res.status(200).json({
        paid: false,
        payment_status: session.payment_status,
        orderId,
      });
    }

    // mark paid
    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: "PAID",
        status: "PROCESSING", // optional
        stripeSessionId: session.id, // keep stored
      },
      select: {
        id: true,
        orderNumber: true,
        paymentStatus: true,
        status: true,
        total: true,
      },
    });

    return res.json({ paid: true, order: updated });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ error: "Erreur serveur (confirmStripePayment)" });
  }
}

// POST /api/orders  => crée l'ordre (avant ou après SumUp)
// POST /api/orders  => crée l'ordre (avant ou après SumUp)
export async function createOrder(req: Request, res: Response) {
  try {
    const { customerName, customerEmail, items, discountCode } = req.body as {
      customerName: string;
      customerEmail: string;
      items: {
        productId: number;
        quantity: number;
        selectedSize?: string;
        selectedColor?: string;
      }[];
      discountCode?: string;
    };

    if (!customerName || !customerEmail || !items?.length) {
      return res.status(400).json({ error: "Missing data" });
    }

    // 1. On récupère les produits depuis la DB (on ne fait pas confiance au front)
    const productIds = items.map((i) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: {
        images: true,
        variants: true,
      },
    });

    // map id -> product
    const productMap = new Map(products.map((p) => [p.id, p]));

    // 2. Calcul du subtotal + préparation des items pour Prisma
    let subtotal = 0;

    const orderItemsData = items.map((item) => {
      const p = productMap.get(item.productId);
      if (!p) {
        throw new Error(`Product ${item.productId} not found`);
      }

      const variant = pickVariant(p, item.selectedSize, item.selectedColor);

      const unitPrice =
        variant && variant.price != null ? Number(variant.price) : 0;

      const lineTotal = unitPrice * item.quantity;
      subtotal += lineTotal;

      return {
        productId: p.id,
        productTitle: p.title,
        productHandle: p.handle,
        mainImage: p.images?.[0]?.src ?? null,
        quantity: item.quantity,
        unitPrice,
        selectedSize: item.selectedSize ?? null,
        selectedColor: item.selectedColor ?? null,
        variantSku: variant?.sku ?? null,
      };
    });

    // 3. Application de la remise
    const { originalTotal, discountAmount, total, appliedCode } = applyDiscount(
      subtotal,
      discountCode
    );

    // 4. Création de l’ordre
    const order = await prisma.order.create({
      data: {
        customerName,
        customerEmail,
        total, // 💰 total après remise
        originalTotal,
        discountCode: appliedCode ?? null,
        discountAmount,
        status: "PENDING",
        paymentStatus: "PENDING",
        items: {
          create: orderItemsData,
        },
      },
      include: {
        items: true,
      },
    });

    res.status(201).json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur (createOrder)" });
  }
}

// GET /api/admin/orders
export async function adminGetOrders(req: Request, res: Response) {
  try {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        items: true,
      },
    });

    const mapped = orders.map((o) => ({
      id: o.id,
      orderNumber: `#${o.orderNumber}`,
      customer: {
        name: o.customerName,
        email: o.customerEmail,
      },
      total: o.total.toFixed(2),
      status: o.status.toLowerCase(), // "pending" etc. pour ton type TS
      paymentStatus: o.paymentStatus.toLowerCase(),
      createdAt: o.createdAt.toISOString(),
    }));

    res.json(mapped);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur (adminGetOrders)" });
  }
}

// POST /api/checkout/intent
// Creates the order (full details stored in DB) but returns ONLY orderId + redirect url
export async function createCheckoutIntent(req: Request, res: Response) {
  try {
    const { customerName, customerEmail, items, discountCode } = req.body as {
      customerName: string;
      customerEmail: string;
      items: {
        productId: number;
        quantity: number;
        selectedSize?: string;
        selectedColor?: string;
      }[];
      discountCode?: string;
    };

    if (!customerName || !customerEmail || !items?.length) {
      return res.status(400).json({ error: "Missing data" });
    }

    const productIds = items.map((i) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { images: true, variants: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    let subtotal = 0;

    const orderItemsData = items.map((item) => {
      const p = productMap.get(item.productId);
      if (!p) throw new Error(`Product ${item.productId} not found`);

      const variant = pickVariant(p, item.selectedSize, item.selectedColor);
      const unitPrice =
        variant && variant.price != null ? Number(variant.price) : 0;

      subtotal += unitPrice * item.quantity;

      return {
        productId: p.id,
        productTitle: p.title,
        productHandle: p.handle,
        mainImage: p.images?.[0]?.src ?? null,
        quantity: item.quantity,
        unitPrice,
        selectedSize: item.selectedSize ?? null,
        selectedColor: item.selectedColor ?? null,
        variantSku: variant?.sku ?? null,
      };
    });

    // 🔽 applique la remise sur le subtotal
    const { originalTotal, discountAmount, total, appliedCode } = applyDiscount(
      subtotal,
      discountCode
    );

    const order = await prisma.order.create({
      data: {
        customerName,
        customerEmail,
        total, // 💰 total après remise
        originalTotal,
        discountCode: appliedCode ?? null,
        discountAmount,
        status: "PENDING",
        paymentStatus: "PENDING",
        items: { create: orderItemsData },
      },
      select: { id: true }, // ✅ only select id
    });

    // send ONLY orderId to second shop
    const base = process.env.CHECKOUT_APP_URL || "http://localhost:5173";
    const redirectUrl = `${base}/checkout-landing?orderId=${order.id}`;

    return res.status(201).json({ orderId: order.id, redirectUrl });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ error: "Erreur serveur (createCheckoutIntent)" });
  }
}

// GET /api/orders/:id/min
export async function getOrderMinimal(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const order = await prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        total: true,
        status: true,
        paymentStatus: true,
        createdAt: true,
      },
    });

    if (!order) return res.status(404).json({ error: "Order not found" });

    return res.json({
      id: order.id,
      total: Number(order.total),
      currency: "EUR", // hardcode for now; later store in DB
      status: order.status,
      paymentStatus: order.paymentStatus,
      createdAt: order.createdAt,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erreur serveur (getOrderMinimal)" });
  }
}

// GET /api/admin/orders/:id
export async function adminGetOrderById(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur (adminGetOrderById)" });
  }
}
