import { Request, Response } from "express";
import Stripe from "stripe";
import prisma from "../prisma";

const secretKey = process.env.STRIPE_SECRET_KEY;
if (!secretKey) {
  throw new Error("Missing STRIPE_SECRET_KEY");
}
const stripe = new Stripe(secretKey || "", {
  apiVersion: (process.env.STRIPE_API_VERSION as any) || "2025-12-15.clover",
});

export async function stripeWebhook(req: Request, res: Response) {
  const sig = req.headers["stripe-signature"] as string | undefined;
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret) {
    return res.status(500).json({ error: "Missing STRIPE_WEBHOOK_SECRET" });
  }
  if (!sig) {
    return res.status(400).json({ error: "Missing stripe-signature header" });
  }

  let event: Stripe.Event;

  try {
    // req.body MUST be a Buffer (raw body)
    event = stripe.webhooks.constructEvent(req.body, sig, secret);
  } catch (err: any) {
    return res
      .status(400)
      .json({ error: `Webhook signature error: ${err.message}` });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.order_id;

      if (orderId) {
        await prisma.order.update({
          where: { id: orderId },
          data: {
            paymentStatus: "PAID",
            status: "PROCESSING",
            stripeSessionId: session.id,
          },
        });
      }
    }

    if (event.type === "checkout.session.expired") {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.order_id;
      if (orderId) {
        // optional: keep PENDING or mark cancelled if you want
        await prisma.order
          .update({
            where: { id: orderId },
            data: { status: "CANCELLED" },
          })
          .catch(() => {});
      }
    }

    // Always 200 fast
    return res.json({ received: true });
  } catch (e) {
    console.error("Webhook handler error:", e);
    return res.status(500).json({ error: "Webhook handler failed" });
  }
}
