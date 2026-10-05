
import {Request,Response} from "express";
import Stripe from "stripe";
import {stripe} from "../services/stripeClient";
import {reconcilePayment,PaymentError} from "../services/paymentService";
import {ReservationError} from "../services/reservations";
import {reconcileReservation} from "../services/reservationReconciliation";
const handled=new Set(["checkout.session.completed","checkout.session.expired",
  "checkout.session.async_payment_succeeded","checkout.session.async_payment_failed"]);
export async function stripeWebhook(req:Request,res:Response) {
  const secret=process.env.STRIPE_WEBHOOK_SECRET,signature=req.headers["stripe-signature"];
  if(!secret) return res.status(503).json({error:"WEBHOOK_NOT_CONFIGURED"});
  if(typeof signature!=="string") return res.status(400).json({error:"Missing stripe-signature header"});
  let event:Stripe.Event;
  try {event=stripe.webhooks.constructEvent(req.body,signature,secret);}
  catch {return res.status(400).json({error:"Invalid webhook signature"});}
  try {
    if(req.app.locals.staging && event.livemode!==false)return res.status(400).json({error:"STAGING_LIVE_EVENT_DENIED"});
    if(handled.has(event.type)) {
      const s=event.data.object as Stripe.Checkout.Session;
      if(!s.id) return res.status(400).json({error:"Missing session ID"});
      const result=await reconcilePayment(s.id,{id:event.id,type:event.type});
      if(event.type==="checkout.session.expired" && !result.paid && "orderId" in result && typeof result.orderId==="string")
        await reconcileReservation(result.orderId);
    }
    return res.json({received:true});
  } catch(error) {
    return res.status((error instanceof PaymentError || error instanceof ReservationError)?error.status:503)
      .json({error:(error instanceof PaymentError || error instanceof ReservationError)?error.code:"WEBHOOK_RETRY"});
  }
}
