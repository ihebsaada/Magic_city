
const {test,before,after,beforeEach}=require("node:test");
const assert=require("node:assert/strict");
const {PrismaClient}=require("@prisma/client");
const RealStripe=require("stripe");
const signer=new RealStripe("sk_test_synthetic_not_a_real_key");
const db=new PrismaClient();
let remote,keys,calls,creations,timeoutBefore,timeoutAfter,delay,server,base,order,legacy;
class FakeStripe {
 constructor() {
  this.checkout={sessions:{
   create:async(p,options)=>{
    calls++;
    assert.ok(options.idempotencyKey.startsWith("pay:"));
    const stored=await db.paymentAttempt.findUnique({where:{id:p.metadata.attempt_id}});
    assert.ok(stored,"attempt committed before external call");
    assert.deepEqual(stored.request,p);
    if(delay)await new Promise(r=>setTimeout(r,delay));
    if(timeoutBefore){timeoutBefore=false;throw new Error("synthetic timeout");}
    let s=keys.get(options.idempotencyKey);
    if(!s) {
     creations++;
     s={id:"cs_synthetic_"+creations,mode:"payment",status:"open",payment_status:"unpaid",
      metadata:p.metadata,amount_total:p.line_items[0].price_data.unit_amount,
      currency:p.line_items[0].price_data.currency,url:"https://stripe.example.invalid/"+creations};
     keys.set(options.idempotencyKey,s);remote.set(s.id,s);
    }
    if(timeoutAfter){timeoutAfter=false;throw new Error("synthetic lost Stripe response");}
    return {...s,metadata:{...s.metadata}};
   },
   retrieve:async(id)=>{assert.ok(remote.has(id));return {...remote.get(id),metadata:{...remote.get(id).metadata}};},
  }};
  this.webhooks={constructEvent:(raw,sig,secret)=>signer.webhooks.constructEvent(raw,sig,secret)};
 }
}
require.cache[require.resolve("stripe")]={exports:FakeStripe};
const {createApp}=require("../dist/app.js");
const shared=require("../dist/prisma.js").default;
const {startPayment}=require("../dist/services/paymentService.js");
before(async()=>{
 assert.match(process.env.DATABASE_URL,/^postgresql:\/\/lot4_test@127\.0\.0\.1:\d+\/lot4_isolated$/);
 legacy=await db.order.findUniqueOrThrow({where:{id:"legacy-before-migration"}});
 server=createApp({logging:false}).listen(0,"127.0.0.1");
 await new Promise(r=>server.once("listening",r));base="http://127.0.0.1:"+server.address().port;
});
after(async()=>{
 server.closeAllConnections();await new Promise(r=>server.close(r));
 await shared.$disconnect();await db.$disconnect();
});
beforeEach(async()=>{
 remote=new Map();keys=new Map();calls=creations=0;timeoutBefore=timeoutAfter=false;delay=0;
 await db.$executeRawUnsafe('DROP TRIGGER IF EXISTS "synthetic_write_failure" ON "PaymentAttempt"');
 await db.stripeEvent.deleteMany();await db.paymentFinalization.deleteMany();await db.paymentAttempt.deleteMany();
 await db.stockReservationItem.deleteMany();await db.orderReservation.deleteMany();
 await db.variant.updateMany({data:{reservedQuantity:0}});
 await db.orderIdempotency.deleteMany();await db.orderItem.deleteMany({where:{orderId:{not:legacy.id}}});
 await db.order.deleteMany({where:{id:{not:legacy.id}}});
 await db.discount.deleteMany();
 await db.discount.create({data:{code:"SYNTHETIC",type:"FIXED",value:"1.00"}});
 order=await db.order.create({data:{customerName:"Synthetic",customerEmail:"synthetic@example.invalid",
   total:"19.99",originalTotal:"20.99",discountAmount:"1.00",discountCode:"SYNTHETIC",currency:"EUR"}});
 const d=await db.discount.findUniqueOrThrow({where:{code:"SYNTHETIC"}});
 await db.discount.update({where:{id:d.id},data:{reservedUses:1}});
 await db.orderReservation.create({data:{orderId:order.id,expiresAt:new Date(Date.now()+3600000),discountId:d.id}});
});
const request=async(path,options={})=>{
 const r=await fetch(base+"/api"+path,{...options,signal:AbortSignal.timeout(10000)});
 assert.equal(r.headers.get("cache-control"),"no-store");
 return {status:r.status,body:await r.json()};
};
const pay=(id=order.id)=>request("/pay",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({orderId:id})});
const confirm=id=>request("/pay/confirm?session_id="+id);
const webhook=(id,type="checkout.session.completed",eventId="evt_synthetic",bad=false)=>{
 const body=JSON.stringify({id:eventId,object:"event",type,data:{object:{id,metadata:{order_id:order.id},payment_status:"paid"}}});
 const sig=signer.webhooks.generateTestHeaderString({payload:body,secret:bad?"incorrect-synthetic":process.env.STRIPE_WEBHOOK_SECRET});
 return request("/stripe/webhook",{method:"POST",headers:{"Content-Type":"application/json","stripe-signature":sig},body});
};
const row=()=>db.order.findUniqueOrThrow({where:{id:order.id}});
const usage=async()=>(await db.discount.findUniqueOrThrow({where:{code:"SYNTHETIC"}})).usageCount;
const paid=id=>Object.assign(remote.get(id),{status:"complete",payment_status:"paid",url:null});

test("two simultaneous /pay calls create one remote session and one persistent attempt",async()=>{
 delay=150;
 const [a,b]=await Promise.all([pay(),pay()]);
 assert.equal(a.status,200);assert.equal(b.status,200);assert.deepEqual(a.body,b.body);
 assert.equal(creations,1);assert.equal(calls,1);assert.equal(await db.paymentAttempt.count(),1);
});
test("repeated /pay reuses the active remote session with the original contract",async()=>{
 const a=await pay(),b=await pay();
 assert.equal(a.status,200);assert.deepEqual(a,b);assert.equal(calls,1);
 assert.deepEqual(Object.keys(a.body).sort(),["sessionId","url"]);
 assert.equal(remote.get(a.body.sessionId).amount_total,1999);
});
test("Stripe timeout before creation reuses the stable key and immutable parameters",async()=>{
 timeoutBefore=true;
 assert.equal((await pay()).status,503);
 const first=await db.paymentAttempt.findFirst();
 assert.equal(first.sessionId,null);
 assert.equal((await pay()).status,200);
 const second=await db.paymentAttempt.findFirst();
 assert.equal(first.idempotencyKey,second.idempotencyKey);assert.deepEqual(first.request,second.request);
 assert.equal(creations,1);
});
test("Stripe created a session but its response was lost: retry returns the same remote session",async()=>{
 timeoutAfter=true;
 assert.equal((await pay()).status,503);assert.equal(creations,1);
 assert.equal((await pay()).status,200);assert.equal(calls,2);assert.equal(creations,1);
 assert.equal(await db.paymentAttempt.count(),1);
});
test("remote success then PostgreSQL persistence failure is recovered using the same Stripe key",async()=>{
 await db.$executeRawUnsafe('CREATE OR REPLACE FUNCTION synthetic_fail_payment_write() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."sessionId" IS NOT NULL THEN RAISE EXCEPTION \'synthetic local write failure\'; END IF; RETURN NEW; END $$');
 await db.$executeRawUnsafe('CREATE TRIGGER "synthetic_write_failure" BEFORE UPDATE ON "PaymentAttempt" FOR EACH ROW EXECUTE FUNCTION synthetic_fail_payment_write()');
 assert.equal((await pay()).status,503);assert.equal(creations,1);
 assert.equal((await db.paymentAttempt.findFirst()).sessionId,null);assert.equal((await row()).stripeSessionId,null);
 await db.$executeRawUnsafe('DROP TRIGGER "synthetic_write_failure" ON "PaymentAttempt"');
 const retry=await pay();assert.equal(retry.status,200);assert.equal(creations,1);assert.equal(calls,2);
 assert.equal((await row()).stripeSessionId,retry.body.sessionId);
});
test("persisted attempt survives reconstruction of application and lease expiry after a crash",async()=>{
 timeoutAfter=true;await pay();
 await db.paymentAttempt.updateMany({data:{leaseOwner:"synthetic-dead-process",leaseUntil:new Date(Date.now()-1)}});
 delete require.cache[require.resolve("../dist/services/paymentService.js")];
 const restarted=require("../dist/services/paymentService.js");
 const result=await restarted.startPayment(order.id);
 assert.equal(result.sessionId,"cs_synthetic_1");assert.equal(creations,1);
});
test("confirmation and signed webhook concurrently finalize once and increment discount once",async()=>{
 const id=(await pay()).body.sessionId;paid(id);
 const [a,b]=await Promise.all([confirm(id),webhook(id)]);
 assert.equal(a.status,200);assert.equal(b.status,200);
 assert.equal((await row()).paymentStatus,"PAID");assert.equal((await row()).status,"PROCESSING");
 assert.equal(await usage(),1);assert.equal(await db.paymentFinalization.count(),1);
 assert.equal(await db.stripeEvent.count(),1);
});
test("duplicate events and repeated confirmations cannot increment discounts twice",async()=>{
 const id=(await pay()).body.sessionId;paid(id);
 for(let i=0;i<3;i++){assert.equal((await webhook(id)).status,200);assert.equal((await confirm(id)).status,200);}
 assert.equal((await webhook(id,"checkout.session.completed","evt_second")).status,200);
 assert.equal(await usage(),1);assert.equal(await db.paymentFinalization.count(),1);assert.equal(await db.stripeEvent.count(),2);
});
test("unpaid signed completed snapshot does not mark a real unpaid session as paid",async()=>{
 const id=(await pay()).body.sessionId;
 assert.equal((await webhook(id)).status,200);
 assert.equal((await row()).paymentStatus,"PENDING");assert.equal(await usage(),0);
 assert.equal((await confirm(id)).body.paid,false);
 paid(id);assert.equal((await webhook(id,"checkout.session.async_payment_succeeded","evt_async")).status,200);
 assert.equal(await usage(),1);
});
test("invalid webhook signature is refused before any payment effect",async()=>{
 const id=(await pay()).body.sessionId;paid(id);
 assert.equal((await webhook(id,"checkout.session.completed","evt_bad",true)).status,400);
 assert.equal((await row()).paymentStatus,"PENDING");assert.equal(await db.stripeEvent.count(),0);assert.equal(await usage(),0);
});
test("incorrect amount is rejected for confirmation and webhook",async()=>{
 const id=(await pay()).body.sessionId;paid(id);remote.get(id).amount_total=2000;
 assert.equal((await confirm(id)).status,409);assert.equal((await webhook(id)).status,409);
 assert.equal((await row()).paymentStatus,"PENDING");assert.equal(await usage(),0);
});
test("incorrect currency is rejected for confirmation and webhook",async()=>{
 const id=(await pay()).body.sessionId;paid(id);remote.get(id).currency="usd";
 assert.equal((await confirm(id)).status,409);assert.equal((await webhook(id)).status,409);
 assert.equal((await row()).paymentStatus,"PENDING");assert.equal(await usage(),0);
});
test("metadata and payment mode must match the stored order and attempt",async()=>{
 const id=(await pay()).body.sessionId;paid(id);
 remote.get(id).metadata.attempt_id="unrecognized-attempt";
 assert.equal((await confirm(id)).status,409);
 remote.get(id).metadata.attempt_id=(await db.paymentAttempt.findFirst()).id;
 remote.get(id).mode="subscription";assert.equal((await webhook(id)).status,409);
 assert.equal((await row()).paymentStatus,"PENDING");
});
test("unknown session with guessed order metadata cannot finalize an order",async()=>{
 remote.set("cs_unknown",{id:"cs_unknown",mode:"payment",status:"complete",payment_status:"paid",
  metadata:{order_id:order.id},amount_total:1999,currency:"eur"});
 assert.equal((await confirm("cs_unknown")).status,409);assert.equal(await usage(),0);
});
test("confirmed expiration permits one new generation; late old expiration cannot cancel the paid new order",async()=>{
 const first=(await pay()).body.sessionId;
 Object.assign(remote.get(first),{status:"expired",url:null});
 assert.equal((await webhook(first,"checkout.session.expired","evt_old")).status,200);
 assert.equal((await row()).status,"PENDING");
 const second=(await pay()).body.sessionId;assert.notEqual(first,second);assert.equal(creations,2);
 paid(second);assert.equal((await confirm(second)).status,200);
 assert.equal((await webhook(first,"checkout.session.expired","evt_late")).status,200);
 assert.equal((await row()).paymentStatus,"PAID");assert.equal((await row()).status,"PROCESSING");assert.equal(await usage(),1);
});
test("out of order expired snapshot cannot regress a actually paid session",async()=>{
 const id=(await pay()).body.sessionId;paid(id);
 assert.equal((await webhook(id,"checkout.session.expired","evt_expired_first")).status,200);
 assert.equal((await webhook(id,"checkout.session.completed","evt_completed_later")).status,200);
 assert.equal((await row()).paymentStatus,"PAID");assert.equal(await usage(),1);
});
test("late events preserve shipped, delivered and refunded states",async()=>{
 const id=(await pay()).body.sessionId;paid(id);await confirm(id);
 for(const status of ["SHIPPED","DELIVERED"]) {
  await db.order.update({where:{id:order.id},data:{status}});
  await webhook(id,"checkout.session.expired","evt_"+status);
  assert.equal((await row()).status,status);assert.equal((await row()).paymentStatus,"PAID");
 }
 await db.order.update({where:{id:order.id},data:{paymentStatus:"REFUNDED"}});
 await webhook(id,"checkout.session.completed","evt_refunded");
 assert.equal((await row()).paymentStatus,"REFUNDED");assert.equal((await row()).status,"DELIVERED");
 assert.equal(await usage(),1);
});
test("finalization of already shipped pending order does not regress fulfillment status",async()=>{
 const id=(await pay()).body.sessionId;paid(id);
 await db.order.update({where:{id:order.id},data:{status:"SHIPPED"}});
 assert.equal((await confirm(id)).status,200);
 assert.equal((await row()).status,"SHIPPED");assert.equal((await row()).paymentStatus,"PAID");
});
test("cancelled order with late real payment requires reconciliation rather than reopening",async()=>{
 const id=(await pay()).body.sessionId;paid(id);
 await db.order.update({where:{id:order.id},data:{status:"CANCELLED"}});
 assert.equal((await confirm(id)).status,409);assert.equal((await row()).status,"CANCELLED");
 assert.equal(await usage(),0);
});
test("legacy active session is adopted and reused without creating a new session",async()=>{
 remote.set("cs_legacy",{id:"cs_legacy",mode:"payment",status:"open",payment_status:"unpaid",
   amount_total:1999,currency:"eur",metadata:{order_id:order.id},url:"https://stripe.example.invalid/legacy"});
 await db.order.update({where:{id:order.id},data:{stripeSessionId:"cs_legacy"}});
 assert.equal((await pay()).body.sessionId,"cs_legacy");assert.equal(calls,0);
 paid("cs_legacy");assert.equal((await confirm("cs_legacy")).status,200);assert.equal(await usage(),1);
});
test("legacy paid order can be confirmed without retrospectively incrementing discount usage",async()=>{
 await db.orderReservation.delete({where:{orderId:order.id}});
 await db.discount.updateMany({data:{reservedUses:0}});
 remote.set("cs_legacy_paid",{id:"cs_legacy_paid",mode:"payment",status:"complete",payment_status:"paid",
  amount_total:1999,currency:"eur",metadata:{order_id:order.id},url:null});
 await db.order.update({where:{id:order.id},data:{stripeSessionId:"cs_legacy_paid",paymentStatus:"PAID",status:"DELIVERED"}});
 assert.equal((await confirm("cs_legacy_paid")).status,200);assert.equal(await usage(),0);
 assert.equal((await row()).status,"DELIVERED");assert.equal((await pay()).status,409);
});
test("additive migration preserves a pre-migration order exactly",async()=>{
 const old=await db.order.findUniqueOrThrow({where:{id:legacy.id}});
 assert.equal(old.total.toFixed(2),legacy.total.toFixed(2));assert.equal(old.total.toFixed(2),"12.34");
 assert.equal(old.updatedAt.toISOString(),legacy.updatedAt.toISOString());assert.equal(old.status,legacy.status);
 assert.equal(await db.paymentAttempt.count({where:{orderId:legacy.id}}),0);
});
test("old unresolved attempts stop before Stripe can forget its idempotency key",async()=>{
 timeoutBefore=true;await pay();
 await db.paymentAttempt.updateMany({data:{createdAt:new Date(Date.now()-24*60*60*1000)}});
 const result=await pay();assert.equal(result.status,409);assert.equal(result.body.error,"PAYMENT_RECONCILIATION_REQUIRED");
 assert.equal(calls,1);assert.equal(creations,0);
});
test("a live crash lease blocks new external calls until its bounded expiry",async()=>{
 timeoutBefore=true;await pay();
 await db.paymentAttempt.updateMany({data:{leaseOwner:"synthetic-dead-process",leaseUntil:new Date(Date.now()+30000)}});
 assert.equal((await pay()).status,503);assert.equal(calls,1);
 await db.paymentAttempt.updateMany({data:{leaseUntil:new Date(0)}});
 assert.equal((await pay()).status,200);assert.equal(creations,1);
});
test("database enforces unique generations, keys and sessions",async()=>{
 await pay();const attempt=await db.paymentAttempt.findFirst();
 const data={orderId:order.id,generation:attempt.generation,id:"synthetic-duplicate",idempotencyKey:"pay:duplicate",
  request:{},amountCents:1999,currency:"eur"};
 await assert.rejects(db.paymentAttempt.create({data}),e=>e.code==="P2002");
 await assert.rejects(db.paymentAttempt.create({data:{...data,generation:2,idempotencyKey:attempt.idempotencyKey}}),e=>e.code==="P2002");
 await assert.rejects(db.paymentAttempt.create({data:{...data,generation:2,sessionId:attempt.sessionId}}),e=>e.code==="P2002");
});

test("payment finalized by webhook recovers remote success before local session persistence",async()=>{
 timeoutAfter=true;assert.equal((await pay()).status,503);
 const id="cs_synthetic_1";paid(id);
 assert.equal((await webhook(id)).status,200);
 assert.equal((await row()).stripeSessionId,id);assert.equal((await row()).paymentStatus,"PAID");
 assert.equal((await db.paymentAttempt.findFirst()).sessionId,id);
 assert.equal((await pay()).status,409);assert.equal(creations,1);assert.equal(await usage(),1);
});
test("failure incrementing discount rolls back payment, ledger and event atomically",async()=>{
 const id=(await pay()).body.sessionId;paid(id);
 await db.$executeRawUnsafe('CREATE OR REPLACE FUNCTION synthetic_fail_discount() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION \'synthetic discount failure\'; END $$');
 await db.$executeRawUnsafe('CREATE TRIGGER "synthetic_discount_failure" BEFORE UPDATE ON "Discount" FOR EACH ROW EXECUTE FUNCTION synthetic_fail_discount()');
 try {
  assert.equal((await webhook(id)).status,503);
  assert.equal((await row()).paymentStatus,"PENDING");assert.equal(await db.paymentFinalization.count(),0);
  assert.equal(await db.stripeEvent.count(),0);assert.equal(await usage(),0);
 } finally {await db.$executeRawUnsafe('DROP TRIGGER "synthetic_discount_failure" ON "Discount"');}
 assert.equal((await webhook(id)).status,200);assert.equal(await usage(),1);
 assert.equal((await row()).paymentStatus,"PAID");assert.equal(await db.paymentFinalization.count(),1);
});
test("a complete unpaid session cannot be replaced by another session",async()=>{
 const id=(await pay()).body.sessionId;
 Object.assign(remote.get(id),{status:"complete",url:null});
 assert.equal((await pay()).status,409);assert.equal(creations,1);assert.equal(await db.paymentAttempt.count(),1);
});
test("simultaneous generation renewal after expiry creates a single new remote session",async()=>{
 const id=(await pay()).body.sessionId;
 Object.assign(remote.get(id),{status:"expired",url:null});delay=150;
 const [a,b]=await Promise.all([pay(),pay()]);
 assert.equal(a.status,200);assert.equal(b.status,200);assert.deepEqual(a.body,b.body);
 assert.equal(creations,2);assert.equal(await db.paymentAttempt.count(),2);
});
test("monotonic Admin updates preserve shipped, delivered and refunded states",async()=>{
 const jwt=require("jsonwebtoken");
 const user=await db.user.upsert({where:{email:"synthetic-lot5-admin@example.invalid"},
   create:{email:"synthetic-lot5-admin@example.invalid",passwordHash:"synthetic-unused-hash"},update:{}});
 const token=jwt.sign({sub:user.id,email:user.email},process.env.JWT_SECRET,{expiresIn:"1h"});
 const patch=body=>request("/admin/orders/"+order.id,{method:"PATCH",
  headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},body:JSON.stringify(body)});
 const id=(await pay()).body.sessionId;paid(id);await confirm(id);
 assert.equal((await patch({paymentStatus:"PENDING"})).status,409);
 assert.equal((await patch({status:"SHIPPED",paymentStatus:"PAID"})).status,200);
 assert.equal((await patch({status:"PROCESSING"})).status,409);
 assert.equal((await patch({status:"DELIVERED"})).status,200);
 assert.equal((await patch({status:"SHIPPED"})).status,409);
 assert.equal((await patch({paymentStatus:"REFUNDED"})).status,200);
 assert.equal((await patch({paymentStatus:"PAID"})).status,409);
 assert.equal((await patch({status:"INVALID"})).status,400);
 assert.equal((await row()).status,"DELIVERED");assert.equal((await row()).paymentStatus,"REFUNDED");
});
