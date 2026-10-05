import {GuestAccessError} from "../services/guestOrderAccess";
// src/controllers/orderController.ts
import { Request, Response } from "express";
import prisma from "../prisma";
import {createIdempotentOrder,IdempotencyError} from "../services/orderIdempotency";
import {reserveLegacyOrder} from "../services/legacyReservation";
import {ReservationError} from "../services/reservations";
import {reconcileReservation} from "../services/reservationReconciliation";
import {OrderInputError} from "../services/orderPricing";
import {startPayment,reconcilePayment,PaymentError,updateOrderState} from "../services/paymentService";

// ======================================================

// ✅ STRIPE CHECKOUT: second shop sends only {orderId}

function paymentFailure(res: Response,error: unknown) {
 const status=(error instanceof PaymentError || error instanceof ReservationError)?error.status:503;
 if(status===503) res.setHeader("Retry-After","2");
 return res.status(status).json({error:(error instanceof PaymentError || error instanceof ReservationError)?error.code:"PAYMENT_RETRY"});
}
export async function createStripeCheckout(req:Request,res:Response) {
 try {return res.json(await startPayment(req.body?.orderId));}
 catch(error) {return paymentFailure(res,error);}
}
export async function confirmStripePayment(req:Request,res:Response) {
 if(typeof req.query.session_id!=="string" || !req.query.session_id || req.query.session_id.length>255)
   return res.status(400).json({error:"Missing session_id"});
 try {return res.json(await reconcilePayment(req.query.session_id));}
 catch(error) {return paymentFailure(res,error);}
}
export async function createCheckoutIntent(req: Request, res: Response) {
  try {
    const result = await createIdempotentOrder(req.body, "intent", req.headers["idempotency-key"],req.headers["order-access-token"]);
    res.setHeader("Idempotency-Replayed", String(result.replayed));
    return res.status(result.status).json(result.response);
  } catch (err) {
    if (err instanceof GuestAccessError) return res.status(err.status).json({error:err.code});
    if (err instanceof ReservationError) return paymentFailure(res,err);
    if (err instanceof IdempotencyError) return res.status(err.status).json({ error: err.code });
    if (err instanceof OrderInputError) return res.status(400).json({ error: err.message });
    console.error("Order operation failed");
    return res.status(500).json({ error: "Erreur serveur (createCheckoutIntent)" });
  }
}

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
    console.error("Order operation failed");
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
    console.error("Order operation failed");
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
    console.error("Order operation failed");
    return res
      .status(500)
      .json({ error: "Erreur serveur (adminGetOrderById)" });
  }
}

// ✅ OPTIONAL: create order directly (if you still use /orders)
export async function createOrder(req: Request, res: Response) {
  try {
    const result = await createIdempotentOrder(req.body, "orders", req.headers["idempotency-key"],req.headers["order-access-token"]);
    res.setHeader("Idempotency-Replayed", String(result.replayed));
    return res.status(result.status).json(result.response);
  } catch (err) {
    if (err instanceof GuestAccessError) return res.status(err.status).json({error:err.code});
    if (err instanceof ReservationError) return paymentFailure(res,err);
    if (err instanceof IdempotencyError) return res.status(err.status).json({ error: err.code });
    if (err instanceof OrderInputError) return res.status(400).json({ error: err.message });
    console.error("Order operation failed");
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

    const updated = await updateOrderState(id,status,paymentStatus);

    if(status==="CANCELLED")await reconcileReservation(id).catch(()=>{});
    return res.json({ ok: true, id: updated.id });
  } catch (err) {
    if (err instanceof PaymentError || err instanceof ReservationError) return paymentFailure(res,err);
    console.error("Order operation failed");
    return res.status(500).json({ error: "Erreur serveur (adminUpdateOrder)" });
  }
}

export async function adminReconcileReservation(req:Request,res:Response) {
 try {return res.json(await reconcileReservation(req.params.id));}
 catch(error){return paymentFailure(res,error);}
}

export async function adminReserveLegacy(req:Request,res:Response) {
 try{return res.json(await reserveLegacyOrder(req.params.id));}
 catch(error){return paymentFailure(res,error);}
}
