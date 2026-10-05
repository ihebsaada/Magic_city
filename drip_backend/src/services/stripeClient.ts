import Stripe from "stripe";
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: process.env.STRIPE_API_VERSION as Stripe.LatestApiVersion,
  timeout: 15000, maxNetworkRetries: 0,
});
if(process.env.DEPLOYMENT_ENV==="staging"){
 // Refuse replay of copied production requests containing a real recipient.
 const create=stripe.checkout.sessions.create.bind(stripe.checkout.sessions);
 stripe.checkout.sessions.create=((params:Stripe.Checkout.SessionCreateParams,options?:Stripe.RequestOptions)=>{
  if(params.customer_email||params.customer||params.payment_intent_data?.receipt_email)throw new Error("STAGING_PAYMENT_REVIEW_REQUIRED");
  return create(params,options);
 }) as typeof stripe.checkout.sessions.create;
 const retrieve=stripe.checkout.sessions.retrieve.bind(stripe.checkout.sessions);
 stripe.checkout.sessions.retrieve=(async(...args:Parameters<typeof stripe.checkout.sessions.retrieve>)=>{
  const session=await retrieve(...args);if(session.livemode!==false)throw new Error("STAGING_LIVE_SESSION_DENIED");return session;
 }) as typeof stripe.checkout.sessions.retrieve;
}
