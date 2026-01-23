// src/controllers/orderController.ts
import { Request, Response } from "express";
import prisma from "../prisma";
import Stripe from "stripe";
import { Prisma } from "@prisma/client";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: process.env.STRIPE_API_VERSION as Stripe.LatestApiVersion,
});

// ======================================================

type ShippingPayload = {
  name?: string;
  phone?: string;
  address1?: string;
  address2?: string;
  city?: string;
  zip?: string;
  state?: string;
  country?: string;
};

function pickVariant(p: any, selectedSize?: string, selectedColor?: string) {
  const variants = p.variants ?? [];
  const match = variants.find((v: any) => {
    const okSize = selectedSize ? v.option1 === selectedSize : true;
    const okColor = selectedColor ? v.option2 === selectedColor : true;
    return okSize && okColor;
  });

  return match ?? variants[0] ?? null;
}

function normCode(code?: string) {
  return (code ?? "").trim().toUpperCase();
}

function toNumberSafe(v: any) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

// ✅ Discount from DB (Prisma Discount)
async function applyDiscountFromDb(subtotal: number, discountCode?: string) {
  const safeSubtotal = Math.max(toNumberSafe(subtotal), 0);
  const code = normCode(discountCode);

  if (!code) {
    return {
      originalTotal: safeSubtotal,
      discountAmount: 0,
      total: safeSubtotal,
      appliedCode: null as string | null,
    };
  }

  const d = await prisma.discount.findUnique({ where: { code } });

  // not found or inactive
  if (!d || !d.active) {
    return {
      originalTotal: safeSubtotal,
      discountAmount: 0,
      total: safeSubtotal,
      appliedCode: null,
    };
  }

  // expired
  if (d.expiresAt && d.expiresAt.getTime() < Date.now()) {
    return {
      originalTotal: safeSubtotal,
      discountAmount: 0,
      total: safeSubtotal,
      appliedCode: null,
    };
  }

  // limit reached
  if (d.usageLimit != null && d.usageCount >= d.usageLimit) {
    return {
      originalTotal: safeSubtotal,
      discountAmount: 0,
      total: safeSubtotal,
      appliedCode: null,
    };
  }

  const value = toNumberSafe(d.value);

  // invalid value => ignore
  if (value <= 0) {
    return {
      originalTotal: safeSubtotal,
      discountAmount: 0,
      total: safeSubtotal,
      appliedCode: null,
    };
  }

  const discountAmount =
    d.type === "PERCENTAGE" ? (safeSubtotal * value) / 100 : value;

  const total = Math.max(safeSubtotal - discountAmount, 0);

  return {
    originalTotal: safeSubtotal,
    discountAmount,
    total,
    appliedCode: code,
  };
}

// ✅ STRIPE CHECKOUT: second shop sends only {orderId}
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
        currency: true,
        customerEmail: true,
        paymentStatus: true,
      },
    });

    if (!order) return res.status(404).json({ error: "Order not found" });

    if (order.paymentStatus === "PAID") {
      return res.status(409).json({ error: "Order already paid" });
    }

    const currency = (order.currency || "EUR").toLowerCase();

    const amountCents = new Prisma.Decimal(order.total)
      .mul(100)
      .toDecimalPlaces(0)
      .toNumber();

    if (!amountCents || amountCents < 50) {
      return res.status(400).json({ error: "Invalid order total" });
    }

    const successTemplate = process.env.STRIPE_SUCCESS_URL || "";
    const cancelTemplate = process.env.STRIPE_CANCEL_URL || "";

    if (!successTemplate || !cancelTemplate) {
      return res.status(500).json({
        error: "Stripe success/cancel URLs not configured",
      });
    }

    const success_url = successTemplate.replace("{ORDER_ID}", order.id);
    const cancel_url = cancelTemplate.replace("{ORDER_ID}", order.id);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url,
      cancel_url,
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
      metadata: { order_id: order.id },
      customer_email: order.customerEmail,
    });

    await prisma.order.update({
      where: { id: order.id },
      data: { stripeSessionId: session.id },
    });

    return res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ error: "Erreur serveur (createStripeCheckout)" });
  }
}

// ✅ Confirm payment
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

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: "PAID",
        status: "PROCESSING",
        stripeSessionId: session.id,
      },
      select: {
        id: true,
        orderNumber: true,
        paymentStatus: true,
        status: true,
        total: true,
        currency: true,
        discountCode: true,
      },
    });

    // ✅ increment usageCount only after payment success
    if (updated.discountCode) {
      try {
        await prisma.discount.update({
          where: { code: updated.discountCode },
          data: { usageCount: { increment: 1 } },
        });
      } catch (e) {
        console.warn("Discount usageCount increment failed:", e);
      }
    }

    return res.json({ paid: true, order: updated });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ error: "Erreur serveur (confirmStripePayment)" });
  }
}

// ✅ Shop principal creates order
export async function createCheckoutIntent(req: Request, res: Response) {
  try {
    const { customerName, customerEmail, items, discountCode, shipping } =
      req.body as {
        customerName: string;
        customerEmail: string;
        items: {
          productId: number;
          quantity: number;
          selectedSize?: string;
          selectedColor?: string;
        }[];
        discountCode?: string;
        shipping?: ShippingPayload;
      };

    if (!customerName || !customerEmail || !items?.length) {
      return res.status(400).json({ error: "Missing data" });
    }

    const currency = (process.env.STRIPE_CURRENCY || "eur").toUpperCase();

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

    // ✅ apply discount from DB
    const { originalTotal, discountAmount, total, appliedCode } =
      await applyDiscountFromDb(subtotal, discountCode);

    const order = await prisma.order.create({
      data: {
        customerName,
        customerEmail,
        currency,

        total,
        originalTotal,
        discountCode: appliedCode, // null if invalid
        discountAmount,

        shippingName: shipping?.name ?? customerName,
        shippingPhone: shipping?.phone ?? null,
        shippingAddress1: shipping?.address1 ?? null,
        shippingAddress2: shipping?.address2 ?? null,
        shippingCity: shipping?.city ?? null,
        shippingZip: shipping?.zip ?? null,
        shippingState: shipping?.state ?? null,
        shippingCountry: shipping?.country ?? null,

        status: "PENDING",
        paymentStatus: "PENDING",
        items: { create: orderItemsData },
      },
      select: { id: true },
    });

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

// ✅ second shop calls this: returns only minimal data
export async function getOrderMinimal(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const order = await prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        total: true,
        currency: true,
        status: true,
        paymentStatus: true,
        createdAt: true,
      },
    });

    if (!order) return res.status(404).json({ error: "Order not found" });

    return res.json({
      id: order.id,
      total: Number(order.total),
      currency: order.currency,
      status: order.status,
      paymentStatus: order.paymentStatus,
      createdAt: order.createdAt,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erreur serveur (getOrderMinimal)" });
  }
}

// ✅ admin list
export async function adminGetOrders(req: Request, res: Response) {
  try {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      include: { items: true },
    });

    const mapped = orders.map((o) => ({
      id: o.id,
      orderNumber: `#${o.orderNumber}`,
      customer: { name: o.customerName, email: o.customerEmail },
      total: o.total.toFixed(2),
      currency: o.currency,
      discountCode: o.discountCode,
      discountAmount: o.discountAmount ? o.discountAmount.toFixed(2) : null,
      status: o.status.toLowerCase(),
      paymentStatus: o.paymentStatus.toLowerCase(),
      createdAt: o.createdAt.toISOString(),
    }));

    res.json(mapped);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur (adminGetOrders)" });
  }
}

// ✅ admin detail mapped
export async function adminGetOrderById(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const o = await prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!o) return res.status(404).json({ error: "Order not found" });

    return res.json({
      id: o.id,
      orderNumber: `#${o.orderNumber}`,
      customer: { name: o.customerName, email: o.customerEmail },

      currency: o.currency,
      total: o.total.toFixed(2),

      originalTotal: o.originalTotal ? o.originalTotal.toFixed(2) : null,
      discountCode: o.discountCode ?? null,
      discountAmount: o.discountAmount ? o.discountAmount.toFixed(2) : null,

      status: o.status.toLowerCase(),
      paymentStatus: o.paymentStatus.toLowerCase(),

      stripeSessionId: o.stripeSessionId ?? null,
      sumupCheckoutId: o.sumupCheckoutId ?? null,
      sumupPaymentId: o.sumupPaymentId ?? null,

      createdAt: o.createdAt.toISOString(),
      updatedAt: o.updatedAt.toISOString(),

      shipping: {
        name: o.shippingName ?? null,
        phone: o.shippingPhone ?? null,
        address1: o.shippingAddress1 ?? null,
        address2: o.shippingAddress2 ?? null,
        city: o.shippingCity ?? null,
        zip: o.shippingZip ?? null,
        state: o.shippingState ?? null,
        country: o.shippingCountry ?? null,
      },

      items: o.items.map((it) => ({
        id: it.id,
        productId: it.productId ?? null,
        productTitle: it.productTitle,
        productHandle: it.productHandle,
        mainImage: it.mainImage ?? null,
        quantity: it.quantity,
        unitPrice: it.unitPrice.toFixed(2),
        selectedSize: it.selectedSize ?? null,
        selectedColor: it.selectedColor ?? null,
        variantSku: it.variantSku ?? null,
      })),
    });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ error: "Erreur serveur (adminGetOrderById)" });
  }
}

// ✅ OPTIONAL: create order directly (if you still use /orders)
export async function createOrder(req: Request, res: Response) {
  try {
    const { customerName, customerEmail, items, discountCode, shipping } =
      req.body as {
        customerName: string;
        customerEmail: string;
        items: {
          productId: number;
          quantity: number;
          selectedSize?: string;
          selectedColor?: string;
        }[];
        discountCode?: string;
        shipping?: ShippingPayload;
      };

    if (!customerName || !customerEmail || !items?.length) {
      return res.status(400).json({ error: "Missing data" });
    }

    const currency = (process.env.STRIPE_CURRENCY || "eur").toUpperCase();

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

    const { originalTotal, discountAmount, total, appliedCode } =
      await applyDiscountFromDb(subtotal, discountCode);

    const order = await prisma.order.create({
      data: {
        customerName,
        customerEmail,
        currency,
        total,
        originalTotal,
        discountCode: appliedCode,
        discountAmount,

        shippingName: shipping?.name ?? customerName,
        shippingPhone: shipping?.phone ?? null,
        shippingAddress1: shipping?.address1 ?? null,
        shippingAddress2: shipping?.address2 ?? null,
        shippingCity: shipping?.city ?? null,
        shippingZip: shipping?.zip ?? null,
        shippingState: shipping?.state ?? null,
        shippingCountry: shipping?.country ?? null,

        status: "PENDING",
        paymentStatus: "PENDING",
        items: { create: orderItemsData },
      },
      include: { items: true },
    });

    return res.status(201).json(order);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erreur serveur (createOrder)" });
  }
}

export async function adminUpdateOrder(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { status, paymentStatus } = req.body as {
      status?: "PENDING" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED";
      paymentStatus?: "PENDING" | "PAID" | "REFUNDED";
    };

    if (!status && !paymentStatus) {
      return res.status(400).json({ error: "Nothing to update" });
    }

    const updated = await prisma.order.update({
      where: { id },
      data: {
        ...(status ? { status: status as any } : {}),
        ...(paymentStatus ? { paymentStatus: paymentStatus as any } : {}),
      },
      select: { id: true },
    });

    return res.json({ ok: true, id: updated.id });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erreur serveur (adminUpdateOrder)" });
  }
}
