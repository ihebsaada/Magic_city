
const {test,before,after,beforeEach}=require("node:test");
const assert=require("node:assert/strict");
const {PrismaClient}=require("@prisma/client");
const RealStripe=require("stripe");
const signer=new RealStripe("sk_test_synthetic_not_a_real_key");
const db=new PrismaClient();
let product,secondProduct,failRetrieve,payDuringExpire;
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
     keys.set(options.idempotencyKey,{...s,metadata:{...s.metadata}});remote.set(s.id,s);
    }
    if(timeoutAfter){timeoutAfter=false;throw new Error("synthetic lost Stripe response");}
    return {...s,metadata:{...s.metadata}};
   },
   expire:async(id)=>{const s=remote.get(id);if(payDuringExpire){paid(id);throw new Error("synthetic concurrent payment");}if(s.status!=="open")throw new Error("synthetic non-open session");Object.assign(s,{status:"expired",url:null});return {...s};},
   retrieve:async(id)=>{if(failRetrieve)throw new Error("synthetic Stripe timeout");assert.ok(remote.has(id));return {...remote.get(id),metadata:{...remote.get(id).metadata}};},
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
 product=await db.product.create({data:{handle:"lot6-synthetic",title:"Synthetic Stock",variants:{create:[{price:"20.00",inventoryQuantity:1,option1:"M",option2:"Blue"},{price:"20.00",inventoryQuantity:5,option1:"L",option2:"Black"}]}},include:{variants:true}});
 secondProduct=await db.product.create({data:{handle:"lot6-second",title:"Synthetic Second",variants:{create:{price:"20.00",inventoryQuantity:5,option1:"S",option2:"Green"}}},include:{variants:true}});
 await db.collection.create({data:{handle:"lot6-collection",title:"Synthetic Collection",products:{create:{productId:product.id}}}});
 server=createApp({logging:false}).listen(0,"127.0.0.1");
 await new Promise(r=>server.once("listening",r));base="http://127.0.0.1:"+server.address().port;
 server.prependListener("request",(req,res)=>{if(req.headers["x-synthetic-drop-response"]==="yes")res.end=()=>res.destroy();});
});
after(async()=>{
 server.closeAllConnections();await new Promise(r=>server.close(r));
 await shared.$disconnect();await db.$disconnect();
});
beforeEach(async()=>{
 failRetrieve=payDuringExpire=false;remote=new Map();keys=new Map();calls=creations=0;timeoutBefore=timeoutAfter=false;delay=0;
 await db.$executeRawUnsafe('DROP TRIGGER IF EXISTS "synthetic_write_failure" ON "PaymentAttempt"');
 await db.stripeEvent.deleteMany();await db.paymentFinalization.deleteMany();await db.paymentAttempt.deleteMany();
 await db.stockReservationItem.deleteMany();await db.orderReservation.deleteMany();
 await db.variant.updateMany({data:{reservedQuantity:0}});
 await db.orderIdempotency.deleteMany();await db.orderItem.deleteMany({where:{orderId:{not:legacy.id}}});
 await db.order.deleteMany({where:{id:{not:legacy.id}}});
 await db.discount.deleteMany();
 await db.discount.create({data:{code:"SYNTHETIC",type:"FIXED",value:"1.00",usageLimit:1}});
 for(const v of product.variants)await db.variant.update({where:{id:v.id},data:{inventoryQuantity:v.option1==="M"?1:5}});
 await db.variant.update({where:{id:secondProduct.variants[0].id},data:{inventoryQuantity:5}});
 order=undefined;
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


const crypto=require("node:crypto");
const {reconcileReservation}=require("../dist/services/reservationReconciliation.js");
const {updateOrderState}=require("../dist/services/paymentService.js");
const line=(quantity=1,variant="M")=>({productId:product.id,quantity,selectedSize:variant,selectedColor:variant==="M"?"Blue":"Black"});
const secondLine=()=>({productId:secondProduct.id,quantity:1,selectedSize:"S",selectedColor:"Green"});
const create=async(items=[line()],code, key="synthetic_"+crypto.randomUUID(),extra={})=>{
 const result=await request("/checkout/intent",{method:"POST",headers:{"Content-Type":"application/json","Idempotency-Key":key,...extra},
  body:JSON.stringify({customerName:"Synthetic",customerEmail:"synthetic@example.invalid",items,discountCode:code})});
 if(result.status===201)order=await db.order.findUniqueOrThrow({where:{id:result.body.orderId}});
 return result;
};
const variant=()=>db.variant.findUniqueOrThrow({where:{id:product.variants.find(v=>v.option1==="M").id}});
const coupon=()=>db.discount.findUniqueOrThrow({where:{code:"SYNTHETIC"}});
const reservation=()=>db.orderReservation.findUniqueOrThrow({where:{orderId:order.id},include:{items:true}});
const elapse=()=>db.orderReservation.update({where:{orderId:order.id},data:{expiresAt:new Date(0)}});
const admin=async(path,body,method="PATCH")=>{
 const jwt=require("jsonwebtoken");
 const u=await db.user.upsert({where:{email:"stock-admin@example.invalid"},create:{email:"stock-admin@example.invalid",passwordHash:"synthetic-unused"},update:{}});
 const token=jwt.sign({sub:u.id,email:u.email},process.env.JWT_SECRET,{expiresIn:"1h"});
 return request(path,{method,headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},body:JSON.stringify(body)});
};
const stock=body=>admin("/admin/products/"+product.id+"/default-variant",body);

test("two orders competing for the last exact variant unit cannot both reserve",async()=>{
 const results=await Promise.all([create(),create()]);
 assert.deepEqual(results.map(x=>x.status).sort(),[201,409]);
 assert.equal(await db.orderReservation.count(),1);assert.equal((await variant()).reservedQuantity,1);
 assert.equal((await variant()).inventoryQuantity,1);assert.equal(await db.orderIdempotency.count(),1);
});
test("other variant stock cannot satisfy an unavailable exact selection",async()=>{
 await db.variant.update({where:{id:(await variant()).id},data:{inventoryQuantity:0}});
 assert.equal((await create()).status,409);assert.equal(await db.orderReservation.count(),0);
 assert.equal((await create([line(1,"L")])).status,201);
});
test("identical lines reserve their aggregated quantity in one reservation row",async()=>{
 await db.variant.update({where:{id:(await variant()).id},data:{inventoryQuantity:2}});
 const result=await create([line(),line()]);assert.equal(result.status,201);
 const r=await reservation();assert.equal(r.items.length,1);assert.equal(r.items[0].quantity,2);
 assert.equal((await variant()).reservedQuantity,2);
 assert.equal((await create()).status,409);
 assert.equal(await db.orderItem.count({where:{orderId:order.id}}),2);
});
test("omitted and explicit options identifying the same variant cannot bypass aggregation",async()=>{
 await db.variant.update({where:{id:secondProduct.variants[0].id},data:{inventoryQuantity:1}});
 const explicit=secondLine(),omitted={productId:secondProduct.id,quantity:1};
 assert.equal((await create([explicit,omitted])).status,409);
 assert.equal(await db.orderReservation.count(),0);
});
test("split lines cannot exceed the per-variant 99-unit limit",async()=>{
 await db.variant.update({where:{id:(await variant()).id},data:{inventoryQuantity:999}});
 assert.equal((await create([line(60),line(60)])).status,400);
 assert.equal((await variant()).reservedQuantity,0);
});
test("null and zero stock are unavailable",async()=>{
 for(const inventoryQuantity of [null,0]) {
  await db.variant.update({where:{id:(await variant()).id},data:{inventoryQuantity}});
  assert.equal((await create()).status,409);assert.equal(await db.orderReservation.count(),0);
 }
});
test("999 means 999 finite units and is not an unlimited-stock sentinel",async()=>{
 await db.variant.update({where:{id:(await variant()).id},data:{inventoryQuantity:999}});
 for(let i=0;i<10;i++)assert.equal((await create([line(99)])).status,201);
 assert.equal((await create([line(10)])).status,409);
 assert.equal((await create([line(9)])).status,201);
 assert.equal((await variant()).reservedQuantity,999);assert.equal((await create()).status,409);
});
test("product without any variant is rejected and creates no reservation",async()=>{
 const p=await db.product.create({data:{handle:"no-variant-"+crypto.randomUUID(),title:"Synthetic No Variant"}});
 assert.equal((await create([{productId:p.id,quantity:1}])).status,400);
 assert.equal(await db.orderReservation.count(),0);
});
test("limited discount last use is atomic even on independent products",async()=>{
 const results=await Promise.all([create([line()],"SYNTHETIC"),create([secondLine()],"SYNTHETIC")]);
 assert.deepEqual(results.map(x=>x.status).sort(),[201,409]);
 assert.equal((await coupon()).reservedUses,1);assert.equal((await coupon()).usageCount,0);
 assert.equal(await db.orderReservation.count(),1);
});
test("discount preview includes reserved uses and cannot promise an exhausted limited code",async()=>{
 assert.equal((await create([line()],"SYNTHETIC")).status,201);
 const r=await request("/discounts/preview",{method:"POST",headers:{"Content-Type":"application/json"},
  body:JSON.stringify({subtotal:20,discountCode:"SYNTHETIC"})});
 assert.equal(r.body.valid,false);assert.equal(r.body.reason,"LIMIT_REACHED");
 assert.equal((await create([secondLine()],"SYNTHETIC")).status,409);
});
test("payment atomically consumes physical stock and the reserved discount exactly once",async()=>{
 await create([line()],"SYNTHETIC");const id=(await pay()).body.sessionId;paid(id);
 assert.equal((await confirm(id)).status,200);assert.equal((await confirm(id)).status,200);
 assert.equal((await reservation()).state,"CONSUMED");
 assert.equal((await variant()).inventoryQuantity,0);assert.equal((await variant()).reservedQuantity,0);
 assert.equal((await coupon()).reservedUses,0);assert.equal((await coupon()).usageCount,1);
});
test("payment and expiration concurrently never release already paid stock",async()=>{
 await create([line()],"SYNTHETIC");const id=(await pay()).body.sessionId;paid(id);await elapse();
 const [a,b]=await Promise.all([confirm(id),reconcileReservation(order.id)]);
 assert.equal(a.status,200);assert.equal(b.state,"CONSUMED");
 assert.equal((await reservation()).state,"CONSUMED");assert.equal((await variant()).inventoryQuantity,0);
 assert.equal((await variant()).reservedQuantity,0);assert.equal(await usage(),1);
});
test("expiration winning before an unexpected late payment blocks consumption of released stock",async()=>{
 await create([line()],"SYNTHETIC");const id=(await pay()).body.sessionId;await elapse();
 assert.equal((await reconcileReservation(order.id)).state,"RELEASED");
 paid(id);assert.equal((await confirm(id)).status,409);
 assert.equal((await row()).status,"CANCELLED");assert.equal((await variant()).inventoryQuantity,1);
 assert.equal((await variant()).reservedQuantity,0);assert.equal(await usage(),0);
});
test("repeated and out-of-order signed webhooks do not consume or release twice",async()=>{
 await create([line()],"SYNTHETIC");const id=(await pay()).body.sessionId;paid(id);
 assert.equal((await webhook(id,"checkout.session.expired","evt_old_snapshot")).status,200);
 for(let i=0;i<3;i++)assert.equal((await webhook(id,"checkout.session.completed","evt_repeated")).status,200);
 await elapse();assert.equal((await reconcileReservation(order.id)).state,"CONSUMED");
 assert.equal((await variant()).inventoryQuantity,0);assert.equal(await usage(),1);
});
test("Admin cannot set physical stock below an active reservation",async()=>{
 await create();
 assert.equal((await stock({inventoryQuantity:0})).status,409);
 assert.equal((await stock({inventoryQuantity:null})).status,409);
 assert.equal((await variant()).inventoryQuantity,1);assert.equal((await variant()).reservedQuantity,1);
 assert.equal((await stock({inventoryQuantity:2})).status,200);
 assert.equal((await variant()).inventoryQuantity,2);assert.equal((await variant()).reservedQuantity,1);
 const id=(await pay()).body.sessionId;paid(id);await confirm(id);
 assert.equal((await variant()).inventoryQuantity,1);assert.equal((await variant()).reservedQuantity,0);
});
test("Admin updating another exact variant does not overwrite reserved stock",async()=>{
 await create();const v=product.variants.find(x=>x.option1==="L");
 assert.equal((await stock({variantId:v.id,inventoryQuantity:0})).status,200);
 assert.equal((await variant()).reservedQuantity,1);assert.equal((await variant()).inventoryQuantity,1);
});
test("Admin stock change concurrent with reservation cannot lose the reservation",async()=>{
 const [a,b]=await Promise.all([create(),stock({inventoryQuantity:0})]);
 assert.ok((a.status===201 && b.status===409) || (a.status===409 && b.status===200));
 const v=await variant();assert.ok(v.reservedQuantity<=v.inventoryQuantity);
 assert.equal(v.reservedQuantity,a.status===201?1:0);
});
test("database rejects direct stock updates that would overwrite a hold",async()=>{
 await create();
 await assert.rejects(db.variant.update({where:{id:(await variant()).id},data:{inventoryQuantity:0}}));
 await assert.rejects(db.variant.update({where:{id:(await variant()).id},data:{inventoryQuantity:null}}));
 assert.equal((await variant()).reservedQuantity,1);
});
test("negative, fractional and malformed Admin stock is rejected",async()=>{
 for(const inventoryQuantity of [-1,1.5,"bad",{},false])
  assert.equal((await stock({inventoryQuantity})).status,400);
 assert.equal((await variant()).inventoryQuantity,1);
});
test("Admin discount limits cannot be lowered below reserved or consumed uses",async()=>{
 await create([line()],"SYNTHETIC");const d=await coupon();
 assert.equal((await admin("/admin/discounts/"+d.id,{usageLimit:0})).status,409);
 assert.equal((await admin("/admin/discounts/"+d.id,{usageLimit:2})).status,200);
 const id=(await pay()).body.sessionId;paid(id);await confirm(id);
 assert.equal((await admin("/admin/discounts/"+d.id,{usageLimit:0})).status,409);
});
test("deactivation and discount price changes preserve the snapshot already reserved",async()=>{
 await create([line()],"SYNTHETIC");const d=await coupon();
 await admin("/admin/discounts/"+d.id,{active:false,value:5});
 const id=(await pay()).body.sessionId;assert.equal(remote.get(id).amount_total,1900);
 paid(id);assert.equal((await confirm(id)).status,200);assert.equal(await usage(),1);
});
test("Admin deletion cannot remove stock or discount reservation history",async()=>{
 await create([line()],"SYNTHETIC");
 assert.equal((await admin("/admin/products/"+product.id,{},"DELETE")).status,409);
 assert.equal((await admin("/admin/discounts/"+(await coupon()).id,{},"DELETE")).status,409);
 assert.ok(await db.product.findUnique({where:{id:product.id}}));
});
test("expired reservation without payment attempts releases stock and discount once",async()=>{
 await create([line()],"SYNTHETIC");await elapse();
 const [a,b]=await Promise.all([reconcileReservation(order.id),reconcileReservation(order.id)]);
 assert.equal(a.state,"RELEASED");assert.equal(b.state,"RELEASED");
 assert.equal((await variant()).reservedQuantity,0);assert.equal((await variant()).inventoryQuantity,1);
 assert.equal((await coupon()).reservedUses,0);assert.equal(await usage(),0);
 assert.equal((await reconcileReservation(order.id)).state,"RELEASED");
});
test("expired open session is expired remotely before releasing its reservation",async()=>{
 await create([line()],"SYNTHETIC");const id=(await pay()).body.sessionId;await elapse();
 assert.equal((await reconcileReservation(order.id)).state,"RELEASED");
 assert.equal(remote.get(id).status,"expired");assert.equal((await variant()).reservedQuantity,0);
});
test("Stripe timeout during reconciliation retains stock and limited coupon",async()=>{
 await create([line()],"SYNTHETIC");await pay();await elapse();failRetrieve=true;
 await assert.rejects(reconcileReservation(order.id));
 assert.equal((await reservation()).state,"ACTIVE");assert.ok((await reservation()).reconciliationReason);
 assert.equal((await variant()).reservedQuantity,1);assert.equal((await coupon()).reservedUses,1);
 failRetrieve=false;assert.equal((await reconcileReservation(order.id)).state,"RELEASED");
});
test("remote creation with lost local result is recovered with its key before release",async()=>{
 await create([line()],"SYNTHETIC");timeoutAfter=true;assert.equal((await pay()).status,503);
 await elapse();assert.equal((await reconcileReservation(order.id)).state,"RELEASED");
 assert.equal(creations,1);assert.equal(calls,2);assert.equal((await variant()).reservedQuantity,0);
});
test("cached Stripe creation response cannot override the current expired session state",async()=>{
 await create();timeoutAfter=true;await pay();
 Object.assign(remote.get("cs_synthetic_1"),{status:"expired",url:null});await elapse();
 assert.equal((await reconcileReservation(order.id)).state,"RELEASED");assert.equal(creations,1);
});
test("unknown remote result older than Stripe key retention is kept for manual review",async()=>{
 await create([line()],"SYNTHETIC");timeoutAfter=true;await pay();await elapse();
 await db.paymentAttempt.updateMany({data:{createdAt:new Date(Date.now()-24*60*60*1000)}});
 await assert.rejects(reconcileReservation(order.id));
 assert.equal((await reservation()).state,"ACTIVE");assert.equal((await variant()).reservedQuantity,1);
 assert.equal((await coupon()).reservedUses,1);assert.equal(calls,1);
});
test("payment racing with remote expiration keeps the hold and can then finalize safely",async()=>{
 await create([line()],"SYNTHETIC");const id=(await pay()).body.sessionId;await elapse();payDuringExpire=true;
 await assert.rejects(reconcileReservation(order.id));
 assert.equal((await reservation()).state,"ACTIVE");assert.equal((await variant()).reservedQuantity,1);
 assert.equal((await confirm(id)).status,200);assert.equal((await reservation()).state,"CONSUMED");
 assert.equal((await variant()).inventoryQuantity,0);assert.equal(await usage(),1);
});
test("transactional reservation failure rolls back the order, key, stock and discount",async()=>{
 await db.$executeRawUnsafe('CREATE OR REPLACE FUNCTION synthetic_fail_reservation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION \'synthetic reservation failure\'; END $$');
 await db.$executeRawUnsafe('CREATE TRIGGER "synthetic_reservation_failure" BEFORE INSERT ON "OrderReservation" FOR EACH ROW EXECUTE FUNCTION synthetic_fail_reservation()');
 const key="synthetic_transaction_retry_001";
 try {
  assert.ok([500,503].includes((await create([line()],"SYNTHETIC",key)).status));
  assert.equal(await db.orderReservation.count(),0);assert.equal(await db.orderIdempotency.count(),0);
  assert.equal((await variant()).reservedQuantity,0);assert.equal((await coupon()).reservedUses,0);
 }finally{await db.$executeRawUnsafe('DROP TRIGGER "synthetic_reservation_failure" ON "OrderReservation"');}
 assert.equal((await create([line()],"SYNTHETIC",key)).status,201);
 assert.equal((await create([line()],"SYNTHETIC",key)).status,201);
 assert.equal((await variant()).reservedQuantity,1);assert.equal((await coupon()).reservedUses,1);
});
test("lost HTTP response after commit replays without reserving stock twice",async()=>{
 const key="synthetic_lost_stock_response_001";
 await assert.rejects(create([line()],"SYNTHETIC",key,{"x-synthetic-drop-response":"yes"}));
 assert.equal((await variant()).reservedQuantity,1);
 assert.equal((await create([line()],"SYNTHETIC",key)).status,201);
 assert.equal((await variant()).reservedQuantity,1);assert.equal((await coupon()).reservedUses,1);
});
test("payment consumption failure rolls back stock, coupon, payment and finalization",async()=>{
 await create([line()],"SYNTHETIC");const id=(await pay()).body.sessionId;paid(id);
 await db.$executeRawUnsafe('CREATE OR REPLACE FUNCTION synthetic_fail_consume() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."state"=\'CONSUMED\' THEN RAISE EXCEPTION \'synthetic consume failure\'; END IF; RETURN NEW; END $$');
 await db.$executeRawUnsafe('CREATE TRIGGER "synthetic_consume_failure" BEFORE UPDATE ON "OrderReservation" FOR EACH ROW EXECUTE FUNCTION synthetic_fail_consume()');
 try {
  assert.equal((await confirm(id)).status,503);assert.equal((await row()).paymentStatus,"PENDING");
  assert.equal((await variant()).reservedQuantity,1);assert.equal((await variant()).inventoryQuantity,1);
  assert.equal((await coupon()).reservedUses,1);assert.equal(await usage(),0);
  assert.equal(await db.paymentFinalization.count(),0);
 }finally{await db.$executeRawUnsafe('DROP TRIGGER "synthetic_consume_failure" ON "OrderReservation"');}
 assert.equal((await confirm(id)).status,200);assert.equal(await usage(),1);
});
test("reservation release failure is rolled back and an explicit retry releases once",async()=>{
 await create([line()],"SYNTHETIC");await elapse();
 await db.$executeRawUnsafe('CREATE OR REPLACE FUNCTION synthetic_fail_release() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."state"=\'RELEASED\' THEN RAISE EXCEPTION \'synthetic release failure\'; END IF; RETURN NEW; END $$');
 await db.$executeRawUnsafe('CREATE TRIGGER "synthetic_release_failure" BEFORE UPDATE ON "OrderReservation" FOR EACH ROW EXECUTE FUNCTION synthetic_fail_release()');
 try {
  await assert.rejects(reconcileReservation(order.id));
  assert.equal((await variant()).reservedQuantity,1);assert.equal((await coupon()).reservedUses,1);
  assert.equal((await row()).status,"PENDING");
 }finally{await db.$executeRawUnsafe('DROP TRIGGER "synthetic_release_failure" ON "OrderReservation"');}
 assert.equal((await reconcileReservation(order.id)).state,"RELEASED");
 assert.equal((await variant()).reservedQuantity,0);assert.equal((await coupon()).reservedUses,0);
});
test("reservation deadline and immutable Stripe session expiration match",async()=>{
 await create();const r=await reservation();const id=(await pay()).body.sessionId;
 const a=await db.paymentAttempt.findFirst({where:{sessionId:id}});
 assert.equal(a.request.expires_at,Math.floor(r.expiresAt.getTime()/1000));
 assert.ok(r.expiresAt.getTime()-r.createdAt.getTime()>=3590000);
});
test("late first /pay is refused while an already-active session can still be reused",async()=>{
 await create();
 await db.orderReservation.update({where:{orderId:order.id},data:{expiresAt:new Date(Date.now()+29*60*1000)}});
 assert.equal((await pay()).status,409);assert.equal(creations,0);
 await db.orderReservation.update({where:{orderId:order.id},data:{expiresAt:new Date(Date.now()+60*60*1000)}});
 const id=(await pay()).body.sessionId;
 await db.orderReservation.update({where:{orderId:order.id},data:{expiresAt:new Date(Date.now()+29*60*1000)}});
 assert.equal((await pay()).body.sessionId,id);assert.equal(creations,1);
});
test("Admin cancellation with no payment releases a reservation immediately once",async()=>{
 await create([line()],"SYNTHETIC");
 assert.equal((await admin("/admin/orders/"+order.id,{status:"CANCELLED"})).status,200);
 assert.equal((await reservation()).state,"RELEASED");assert.equal((await variant()).reservedQuantity,0);
 assert.equal((await coupon()).reservedUses,0);
});
test("Admin cancellation expires an unpaid Stripe session before releasing stock",async()=>{
 await create();const id=(await pay()).body.sessionId;
 assert.equal((await admin("/admin/orders/"+order.id,{status:"CANCELLED"})).status,200);
 assert.equal(remote.get(id).status,"expired");assert.equal((await reservation()).state,"RELEASED");
});
test("paid cancellation or refund never automatically restocks consumed units",async()=>{
 await create();const id=(await pay()).body.sessionId;paid(id);await confirm(id);
 await admin("/admin/orders/"+order.id,{status:"CANCELLED"});
 await admin("/admin/orders/"+order.id,{paymentStatus:"REFUNDED"});
 assert.equal((await reservation()).state,"CONSUMED");assert.equal((await variant()).inventoryQuantity,0);
});
test("reconciliation endpoint is authenticated and exposes no anonymous mutation",async()=>{
 await create();await elapse();
 assert.equal((await request("/admin/orders/"+order.id+"/reconcile-reservation",{method:"POST"})).status,401);
 assert.equal((await reservation()).state,"ACTIVE");
 const result=await admin("/admin/orders/"+order.id+"/reconcile-reservation",{},"POST");
 assert.equal(result.status,200);assert.equal(result.body.state,"RELEASED");
});
test("pre-migration orders retain data and unreserved pending payment requires review",async()=>{
 const before=await db.order.findUniqueOrThrow({where:{id:legacy.id}});
 assert.equal(await reconcileReservation(legacy.id),null);
 assert.deepEqual(await db.order.findUniqueOrThrow({where:{id:legacy.id}}),before);
 assert.equal(before.total.toFixed(2),"12.34");assert.equal(await db.orderReservation.count({where:{orderId:legacy.id}}),0);
 const start=await pay(legacy.id);assert.equal(start.status,409);assert.equal(start.body.error,"LEGACY_RESERVATION_REVIEW");
 assert.equal(creations,0);assert.deepEqual(await db.order.findUniqueOrThrow({where:{id:legacy.id}}),before);
 assert.equal((await variant()).inventoryQuantity,1);assert.equal((await variant()).reservedQuantity,0);
});
test("public product and collection stock subtracts active reservations",async()=>{
 await create();
 const r=await fetch(base+"/api/products/"+product.id);assert.equal(r.status,200);
 assert.equal((await r.json()).stock,5);
 const group=await fetch(base+"/api/collections/lot6-collection/products");assert.equal(group.status,200);assert.equal((await group.json()).products[0].stock,5); // M=0 available, L=5 available.
});

test("additive migration preserves old default 999, null and zero stock values",async()=>{
 const p=await db.product.findUniqueOrThrow({where:{handle:"legacy-stock-before-migration"},include:{variants:{orderBy:{id:"asc"}}}});
 assert.deepEqual(p.variants.map(v=>v.inventoryQuantity),[999,null,0]);
 assert.deepEqual(p.variants.map(v=>v.reservedQuantity),[0,0,0]);
});
test("new Admin product without an explicit stock starts unavailable",async()=>{
 const r=await admin("/admin/products",{title:"Synthetic New",handle:"synthetic-new-"+crypto.randomUUID(),price:10},"POST");
 assert.equal(r.status,201);assert.equal(r.body.variants[0].inventoryQuantity,0);assert.equal(r.body.variants[0].reservedQuantity,0);
});
test("manual Admin paid declaration consumes its reservation once and confirmation cannot consume again",async()=>{
 await create([line()],"SYNTHETIC");const id=(await pay()).body.sessionId;
 assert.equal((await admin("/admin/orders/"+order.id,{paymentStatus:"PAID"})).status,200);
 assert.equal((await admin("/admin/orders/"+order.id,{paymentStatus:"PAID"})).status,200);
 paid(id);assert.equal((await confirm(id)).status,200);
 assert.equal((await variant()).inventoryQuantity,0);assert.equal(await usage(),1);
 assert.equal((await reservation()).state,"CONSUMED");
});
test("cancellation discovering an actual paid session retains stock until an explicit paid declaration",async()=>{
 await create([line()],"SYNTHETIC");const id=(await pay()).body.sessionId;paid(id);
 assert.equal((await admin("/admin/orders/"+order.id,{status:"CANCELLED"})).status,200);
 assert.equal((await reservation()).state,"ACTIVE");assert.equal((await variant()).reservedQuantity,1);
 assert.equal((await reservation()).reconciliationReason,"PAYMENT_RECONCILIATION_REQUIRED");
 assert.equal((await admin("/admin/orders/"+order.id,{paymentStatus:"PAID"})).status,200);
 assert.equal((await variant()).inventoryQuantity,0);assert.equal((await reservation()).state,"CONSUMED");
});
test("a complete unpaid Stripe session holds stock and discount for reconciliation",async()=>{
 await create([line()],"SYNTHETIC");const id=(await pay()).body.sessionId;
 Object.assign(remote.get(id),{status:"complete",url:null});await elapse();
 await assert.rejects(reconcileReservation(order.id));
 assert.equal((await reservation()).state,"ACTIVE");assert.equal((await variant()).reservedQuantity,1);
 assert.equal((await coupon()).reservedUses,1);assert.equal((await pay()).status,409);
});
test("expired unused discount capacity becomes available for a new legitimate order",async()=>{
 await create([line()],"SYNTHETIC");await elapse();await reconcileReservation(order.id);
 assert.equal((await create([secondLine()],"SYNTHETIC")).status,201);
 assert.equal((await coupon()).reservedUses,1);assert.equal((await coupon()).usageCount,0);
});

test("explicit authenticated reservation makes a historical order payable without repricing it",async()=>{
 const original=await db.order.findUniqueOrThrow({where:{id:legacy.id}});
 assert.equal((await pay(legacy.id)).status,409);
 assert.equal((await request("/admin/orders/"+legacy.id+"/reserve-legacy",{method:"POST"})).status,401);
 const result=await admin("/admin/orders/"+legacy.id+"/reserve-legacy",{},"POST");
 assert.equal(result.status,200);assert.equal(result.body.state,"ACTIVE");assert.equal(result.body.items[0].quantity,1);
 const repeated=await admin("/admin/orders/"+legacy.id+"/reserve-legacy",{},"POST");
 assert.equal(repeated.status,200);assert.equal(repeated.body.items[0].quantity,1);
 const old=await db.order.findUniqueOrThrow({where:{id:legacy.id}});
 assert.deepEqual(old,original); // Creating the reservation does not rewrite the historical order.
 const start=await pay(legacy.id);assert.equal(start.status,200);
 assert.equal(remote.get(start.body.sessionId).amount_total,1234);
 paid(start.body.sessionId);assert.equal((await confirm(start.body.sessionId)).status,200);
 const item=result.body.items[0];const v=await db.variant.findUniqueOrThrow({where:{id:item.variantId}});
 assert.equal(v.inventoryQuantity,998);assert.equal(v.reservedQuantity,0);
 assert.equal((await variant()).inventoryQuantity,1);
});
