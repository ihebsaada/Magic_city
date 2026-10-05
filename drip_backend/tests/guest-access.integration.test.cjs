
const {test,before,after,beforeEach}=require("node:test");
const assert=require("node:assert/strict");
const {createHash}=require("node:crypto");
const {PrismaClient}=require("@prisma/client");
const jwt=require("jsonwebtoken");
const db=new PrismaClient();
let server,base,app,product,legacy,remote,emails,deliveryFailure,calls,retrieves;
const realStripe=require("stripe"),signer=new realStripe("sk_test_synthetic_not_a_real_key");
class FakeStripe {
 constructor(){
  this.checkout={sessions:{
   create:async(p)=>{calls++;const id="cs_guest_"+calls;const s={id,mode:"payment",status:"open",payment_status:"unpaid",metadata:p.metadata,amount_total:p.line_items[0].price_data.unit_amount,currency:p.line_items[0].price_data.currency,url:"https://stripe.example.invalid/"+id};remote.set(id,s);return s;},
   retrieve:async(id)=>{retrieves++;if(!remote.has(id))throw new Error("synthetic missing session");return remote.get(id);}
  }};
  this.webhooks={constructEvent:(raw,sig,secret)=>signer.webhooks.constructEvent(raw,sig,secret)};
 }
}
require.cache[require.resolve("stripe")]={exports:FakeStripe};
const {createApp}=require("../dist/app.js"),shared=require("../dist/prisma.js").default;
const hash=t=>createHash("sha256").update(t).digest("hex");
const delivery=async(message)=>{if(deliveryFailure)throw new Error("synthetic delivery failure");emails.push(message);};
async function restart(){
 if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}
 app=createApp({logging:false,orderRecoveryDelivery:delivery});
 server=app.listen(0,"127.0.0.1");await new Promise(r=>server.once("listening",r));
 base="http://127.0.0.1:"+server.address().port;
}
before(async()=>{
 const testUrl=new URL(process.env.DATABASE_URL);assert.equal(testUrl.hostname,"127.0.0.1");assert.equal(testUrl.username,"lot4_test");assert.equal(testUrl.pathname,"/lot4_isolated");
 legacy=await db.order.findUniqueOrThrow({where:{id:"legacy-before-migration"}});
 product=await db.product.create({data:{handle:"guest-synthetic",title:"Synthetic",variants:{create:{price:"20.00",inventoryQuantity:99,option1:"M",option2:"Blue"}}}});
 await restart();
});
after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));await shared.$disconnect();await db.$disconnect();});
beforeEach(async()=>{
 app.locals.orderAccessRequired=false;app.locals.orderRecoveryDelivery=delivery;
 emails=[];deliveryFailure=false;remote=new Map();calls=retrieves=0;
 await db.guestOrderRecovery.deleteMany();await db.guestOrderAccess.deleteMany();
 await db.stripeEvent.deleteMany();await db.paymentFinalization.deleteMany();await db.paymentAttempt.deleteMany();
 await db.stockReservationItem.deleteMany();await db.orderReservation.deleteMany();
 await db.variant.updateMany({data:{reservedQuantity:0}});
 await db.orderIdempotency.deleteMany();await db.orderItem.deleteMany({where:{orderId:{not:legacy.id}}});
 await db.order.deleteMany({where:{id:{not:legacy.id}}});
 await db.discount.updateMany({data:{reservedUses:0}});
});
async function request(path,{method="GET",token,body,headers={},raw}={}){
 const r=await fetch(base+"/api"+path,{method,headers:{...(body!==undefined||raw!==undefined?{"Content-Type":"application/json"}:{}),...(token!==undefined?{"Order-Access-Token":token}:{}),...headers},body:raw??(body===undefined?undefined:JSON.stringify(body)),signal:AbortSignal.timeout(10000)});
 assert.equal(r.headers.get("cache-control"),"no-store");assert.equal(r.headers.get("referrer-policy"),"no-referrer");
 return {status:r.status,body:await r.json()};
}
const prepare=()=>request("/order-access/prepare",{method:"POST"});
const body=()=>({customerName:"Synthetic",customerEmail:"synthetic@example.invalid",items:[{productId:product.id,quantity:1,selectedSize:"M",selectedColor:"Blue"}]});
async function create(token,key,path="/checkout/intent",data=body()){
 return request(path,{method:"POST",token,body:data,headers:key?{"Idempotency-Key":key}:{}});
}
async function bound(){
 const p=await prepare();assert.equal(p.status,201);
 const c=await create(p.body.accessToken);assert.equal(c.status,201);
 return {token:p.body.accessToken,id:c.body.orderId};
}
const minimal=(id,token)=>request("/orders/"+id+"/min",{token});
const pay=(id,token)=>request("/pay",{method:"POST",body:{orderId:id},token});
const confirm=(id,token)=>request("/pay/confirm?session_id="+id,{token});
const recover=(id=legacy.id,email=legacy.customerEmail)=>request("/order-access/recovery",{method:"POST",body:{orderId:id,email}});
const redeem=token=>request("/order-access/redeem",{method:"POST",body:{recoveryToken:token}});
async function admin(){
 const user=await db.user.upsert({where:{email:"guest-admin@example.invalid"},update:{},create:{email:"guest-admin@example.invalid",passwordHash:"synthetic-not-for-login"}});
 return {Authorization:"Bearer "+jwt.sign({sub:user.id,email:user.email},process.env.JWT_SECRET,{expiresIn:"1h"})};
}

test("preparation returns a 256-bit random token; PostgreSQL stores only its hash",async()=>{
 const a=await prepare(),b=await prepare();assert.equal(a.status,201);assert.match(a.body.accessToken,/^[A-Za-z0-9_-]{43}$/);assert.notEqual(a.body.accessToken,b.body.accessToken);
 const row=await db.guestOrderAccess.findUniqueOrThrow({where:{tokenHash:hash(a.body.accessToken)}});
 assert.equal(row.orderId,null);assert.ok(row.expiresAt.getTime()>Date.now());assert.ok(!JSON.stringify(row).includes(a.body.accessToken));
});
test("valid token is atomically bound to one order and permits consultation",async()=>{
 const a=await bound();assert.equal((await minimal(a.id,a.token)).status,200);
 const row=await db.guestOrderAccess.findUniqueOrThrow({where:{tokenHash:hash(a.token)}});assert.equal(row.orderId,a.id);assert.ok(row.expiresAt.getTime()>Date.now()+29*86400000);
});
test("legacy clients retain unchanged creation and consultation contracts",async()=>{
 const c=await create();assert.equal(c.status,201);assert.deepEqual(Object.keys(c.body).sort(),["orderId","redirectUrl"]);
 assert.equal((await minimal(c.body.orderId)).status,200);assert.equal(await db.guestOrderAccess.count(),0);
});
test("malformed and unknown credentials never fall back to anonymous access",async()=>{
 const a=await bound();
 for(const t of ["bad","A".repeat(43),""])assert.deepEqual(await minimal(a.id,t),{status:401,body:{error:"ORDER_ACCESS_DENIED"}});
});
test("a prepared but unbound token cannot access an order",async()=>{
 const c=await create(),p=await prepare();assert.equal((await minimal(c.body.orderId,p.body.accessToken)).status,401);
});
test("token from order A cannot consult or pay order B",async()=>{
 const a=await bound(),b=await bound();
 assert.equal((await minimal(b.id,a.token)).status,401);assert.equal((await pay(b.id,a.token)).status,401);assert.equal(calls,0);
});
test("expired and revoked credentials deny consultation and payment",async()=>{
 const a=await bound();await db.guestOrderAccess.update({where:{tokenHash:hash(a.token)},data:{expiresAt:new Date(0)}});
 assert.equal((await minimal(a.id,a.token)).status,401);assert.equal((await pay(a.id,a.token)).status,401);
 await db.guestOrderAccess.update({where:{tokenHash:hash(a.token)},data:{expiresAt:new Date(Date.now()+10000),revokedAt:new Date()}});
 assert.equal((await minimal(a.id,a.token)).status,401);assert.equal(calls,0);
});
test("prepared token is single-order; a second binding rolls back order and stock",async()=>{
 const a=await bound(),before=await db.order.count(),v=await db.variant.findFirstOrThrow({where:{productId:product.id}});
 assert.equal((await create(a.token)).status,401);assert.equal(await db.order.count(),before);
 assert.equal((await db.variant.findUniqueOrThrow({where:{id:v.id}})).reservedQuantity,v.reservedQuantity);
});
test("expired prepared token cannot create an order",async()=>{
 const p=await prepare();await db.guestOrderAccess.update({where:{tokenHash:hash(p.body.accessToken)},data:{expiresAt:new Date(0)}});
 const before=await db.order.count();assert.equal((await create(p.body.accessToken)).status,401);assert.equal(await db.order.count(),before);
});
test("idempotent retries keep identical response and token; no secret in stored snapshot",async()=>{
 const p=await prepare(),token=p.body.accessToken,key="guest_same_key_synthetic";
 const a=await create(token,key),b=await create(token,key);assert.equal(a.status,201);assert.deepEqual(a,b);
 const record=await db.orderIdempotency.findFirstOrThrow();assert.ok(!JSON.stringify(record).includes(token));
 assert.equal((await minimal(a.body.orderId,token)).status,200);
});
test("same idempotency key without original credential or with another credential conflicts",async()=>{
 const p=await prepare();await create(p.body.accessToken,"guest_conflict_key_synthetic");
 assert.equal((await create(undefined,"guest_conflict_key_synthetic")).status,409);
 const other=await prepare();assert.equal((await create(other.body.accessToken,"guest_conflict_key_synthetic")).status,409);
});
test("concurrent identical creation binds only one order",async()=>{
 const p=await prepare();const [a,b]=await Promise.all([create(p.body.accessToken,"guest_concurrent_synthetic"),create(p.body.accessToken,"guest_concurrent_synthetic")]);
 assert.equal(a.status,201);assert.deepEqual(a,b);assert.equal(await db.order.count({where:{id:{not:legacy.id}}}),1);
});
test("tokens remain valid after application restart",async()=>{
 const a=await bound();await restart();assert.equal((await minimal(a.id,a.token)).status,200);
});
test("payment and confirmation accept valid scoped token",async()=>{
 const a=await bound(),p=await pay(a.id,a.token);assert.equal(p.status,200);
 Object.assign(remote.get(p.body.sessionId),{status:"complete",payment_status:"paid"});
 assert.equal((await confirm(p.body.sessionId,a.token)).status,200);
});
test("confirmation resolves local session owner and rejects cross-order token without Stripe call",async()=>{
 const a=await bound(),b=await bound(),p=await pay(b.id,b.token);
 assert.equal((await confirm(p.body.sessionId,a.token)).status,401);
 assert.equal((await confirm("cs_unknown",a.token)).status,503);
 assert.equal((await db.order.findUniqueOrThrow({where:{id:b.id}})).paymentStatus,"PENDING");
});
test("legacy Stripe session lookup also enforces its locally recorded order",async()=>{
 const a=await bound(),b=await bound();await db.order.update({where:{id:b.id},data:{stripeSessionId:"cs_legacy_guest"}});
 assert.equal((await confirm("cs_legacy_guest",a.token)).status,401);
});
test("mandatory mode is prepared but defaults off; protected routes deny anonymous requests",async()=>{
 const a=await bound();app.locals.orderAccessRequired=true;
 assert.equal((await minimal(a.id)).status,401);assert.equal((await pay(a.id)).status,401);
 assert.equal((await confirm("cs_unknown")).status,401);assert.equal((await create()).status,401);
 assert.equal((await minimal(a.id,a.token)).status,200);
 const p=await prepare();assert.equal((await create(p.body.accessToken)).status,201);
});
test("Admin JWT retains list/detail/revocation access; guest token never authorizes Admin",async()=>{
 const a=await bound(),headers=await admin();
 assert.equal((await request("/admin/orders",{headers})).status,200);
 assert.equal((await request("/admin/orders/"+a.id,{headers})).status,200);
 assert.equal((await request("/admin/orders",{headers:{Authorization:"Bearer "+a.token}})).status,401);
 assert.equal((await request("/admin/orders/"+a.id+"/revoke-access",{method:"POST"})).status,401);
 assert.equal((await request("/admin/orders/"+a.id+"/revoke-access",{method:"POST",headers})).status,200);
 assert.equal((await minimal(a.id,a.token)).status,401);
});
test("token query parameters are rejected and never reflected",async()=>{
 const a=await bound(),r=await request("/orders/"+a.id+"/min?accessToken="+a.token);
 assert.equal(r.status,400);assert.ok(!JSON.stringify(r.body).includes(a.token));
});
test("malformed JSON never echoes secret in error response",async()=>{
 const p=await prepare(),r=await request("/order-access/redeem",{method:"POST",raw:'{"recoveryToken":"'+p.body.accessToken+'"'});
 assert.equal(r.status,400);assert.ok(!JSON.stringify(r.body).includes(p.body.accessToken));
});
test("old order has no implicit grant and is not changed by migration",async()=>{
 const row=await db.order.findUniqueOrThrow({where:{id:legacy.id}});
 assert.equal(row.total.toFixed(2),"12.34");assert.equal(await db.guestOrderAccess.count({where:{orderId:legacy.id}}),0);
 assert.equal((await minimal(legacy.id)).status,200);app.locals.orderAccessRequired=true;assert.equal((await minimal(legacy.id)).status,401);
});
test("recovery responds uniformly for missing ID, wrong email and valid request",async()=>{
 const missing=await recover("not-an-order","nobody@example.invalid"),wrong=await recover(legacy.id,"wrong@example.invalid"),ok=await recover();
 assert.deepEqual(missing,ok);assert.deepEqual(wrong,ok);assert.equal(ok.status,202);assert.equal(emails.length,1);
 assert.equal(emails[0].email,legacy.customerEmail);assert.ok(!JSON.stringify(ok).includes(emails[0].recoveryToken));
 const row=await db.guestOrderRecovery.findFirstOrThrow();assert.equal(row.tokenHash,hash(emails[0].recoveryToken));assert.ok(!JSON.stringify(row).includes(emails[0].recoveryToken));
});
test("order ID and even correct email alone never grant access: delivered secret required",async()=>{
 await recover();assert.equal((await minimal(legacy.id,"A".repeat(43))).status,401);
 assert.equal((await redeem(legacy.id)).status,401);
 const r=await redeem(emails[0].recoveryToken);assert.equal(r.status,200);assert.equal(r.body.orderId,legacy.id);
 assert.equal((await minimal(legacy.id,r.body.accessToken)).status,200);
});
test("recovery is one-use and concurrent redemption produces one token",async()=>{
 await recover();const [a,b]=await Promise.all([redeem(emails[0].recoveryToken),redeem(emails[0].recoveryToken)]);
 assert.deepEqual([a.status,b.status].sort(),[200,401]);assert.equal(await db.guestOrderAccess.count({where:{orderId:legacy.id}}),1);
});
test("expired recovery challenge is denied",async()=>{
 await recover();await db.guestOrderRecovery.updateMany({data:{expiresAt:new Date(0)}});
 assert.equal((await redeem(emails[0].recoveryToken)).status,401);
});
test("recovery rotates all old credentials and invalidates pending challenges",async()=>{
 const a=await bound();await recover(a.id,"synthetic@example.invalid");await recover(a.id,"synthetic@example.invalid");
 const r=await redeem(emails[0].recoveryToken);assert.equal(r.status,200);
 assert.equal((await minimal(a.id,a.token)).status,401);assert.equal((await minimal(a.id,r.body.accessToken)).status,200);
 assert.equal((await redeem(emails[1].recoveryToken)).status,401);
});
test("Admin revocation invalidates pending recovery as well as existing grant",async()=>{
 await recover();const headers=await admin();
 await request("/admin/orders/"+legacy.id+"/revoke-access",{method:"POST",headers});
 assert.equal((await redeem(emails[0].recoveryToken)).status,401);
});
test("recovery is explicitly unavailable without verified delivery transport",async()=>{
 app.locals.orderRecoveryDelivery=undefined;
 assert.deepEqual(await recover(),{status:503,body:{error:"ORDER_RECOVERY_UNAVAILABLE"}});
 assert.equal(await db.guestOrderRecovery.count(),0);
});
test("failed delivery invalidates challenge and returns generic response",async()=>{
 deliveryFailure=true;assert.equal((await recover()).status,202);
 const row=await db.guestOrderRecovery.findFirstOrThrow();assert.ok(row.usedAt);
});
test("recovery allows at most five deliveries per order per hour, even concurrently",async()=>{
 const replies=await Promise.all(Array.from({length:8},()=>recover()));
 assert.ok(replies.every(r=>r.status===202));assert.equal(emails.length,5);
});
test("revoked token cannot retrieve an idempotent order response",async()=>{
 const p=await prepare(),key="guest_revoked_replay_synthetic";await create(p.body.accessToken,key);
 await db.guestOrderAccess.updateMany({data:{revokedAt:new Date()}});
 assert.equal((await create(p.body.accessToken,key)).status,401);
});
test("logging never records credentials, queries or malformed request bodies",async()=>{
 let output="";const write=process.stdout.write;process.stdout.write=function(chunk,...args){output+=String(chunk);return write.call(this,chunk,...args);};
 const local=createApp({logging:true}).listen(0,"127.0.0.1");await new Promise(r=>local.once("listening",r));
 const token="synthetic-log-secret-not-a-real-token";
 try{
  await fetch("http://127.0.0.1:"+local.address().port+"/api/order-access/redeem",{method:"POST",headers:{"Content-Type":"application/json"},body:'{"recoveryToken":"'+token+'"'});
  await fetch("http://127.0.0.1:"+local.address().port+"/?accessToken="+token);
  await new Promise(r=>setTimeout(r,25));assert.ok(!output.includes(token));
 }finally{process.stdout.write=write;local.closeAllConnections();await new Promise(r=>local.close(r));}
});

test("confirmation recovers remote creation before local session persistence, within token scope",async()=>{
 const a=await bound(),p=await pay(a.id,a.token);
 const attempt=await db.paymentAttempt.findFirstOrThrow({where:{orderId:a.id}});
 await db.paymentAttempt.update({where:{id:attempt.id},data:{sessionId:null,sessionUrl:null,state:"CREATING"}});
 await db.order.update({where:{id:a.id},data:{stripeSessionId:null}});
 Object.assign(remote.get(p.body.sessionId),{status:"complete",payment_status:"paid"});
 assert.equal((await confirm(p.body.sessionId,a.token)).status,200);
 assert.equal((await db.order.findUniqueOrThrow({where:{id:a.id}})).paymentStatus,"PAID");
});
test("invalid confirmation credential never calls Stripe for an unrecorded session",async()=>{
 const a=await bound();assert.equal((await confirm("cs_unrecorded","A".repeat(43))).status,401);assert.equal(retrieves,0);
});
test("concurrent revocation and recovery redemption cannot leave a token active after revocation",async()=>{
 await recover();const headers=await admin();
 const [r,a]=await Promise.all([
  redeem(emails[0].recoveryToken),
  request("/admin/orders/"+legacy.id+"/revoke-access",{method:"POST",headers})
 ]);
 assert.equal(a.status,200);assert.ok([200,401].includes(r.status));
 if(r.status===200)assert.equal((await minimal(legacy.id,r.body.accessToken)).status,401);
});
test("CORS permits the credential header on cross-origin requests",async()=>{
 const r=await fetch(base+"/api/pay",{method:"OPTIONS",headers:{Origin:"https://store.example.invalid","Access-Control-Request-Method":"POST","Access-Control-Request-Headers":"order-access-token,content-type"}});
 assert.equal(r.status,204);assert.match(r.headers.get("access-control-allow-headers"),/order-access-token/i);
});
test("lost creation response can be replayed with the same prepared credential",async()=>{
 const p=await prepare(),key="guest_lost_response_synthetic";
 const handler=(req,res)=>{if(req.headers["x-guest-drop-response"]==="yes")res.end=()=>res.destroy();};
 server.prependListener("request",handler);
 try{await assert.rejects(request("/checkout/intent",{method:"POST",token:p.body.accessToken,body:body(),headers:{"Idempotency-Key":key,"x-guest-drop-response":"yes"}}));}
 finally{server.removeListener("request",handler);}
 // Simulate response loss without changing persisted snapshot or credential.
 const r=await create(p.body.accessToken,key);assert.equal(r.status,201);
 assert.equal(await db.order.count({where:{id:{not:legacy.id}}}),1);
 assert.equal((await minimal(r.body.orderId,p.body.accessToken)).status,200);
});

test("expired and revoked tokens cannot confirm a valid payment session",async()=>{
 const a=await bound(),p=await pay(a.id,a.token);
 await db.guestOrderAccess.update({where:{tokenHash:hash(a.token)},data:{expiresAt:new Date(0)}});
 assert.equal((await confirm(p.body.sessionId,a.token)).status,401);
 await db.guestOrderAccess.update({where:{tokenHash:hash(a.token)},data:{expiresAt:new Date(Date.now()+10000),revokedAt:new Date()}});
 assert.equal((await confirm(p.body.sessionId,a.token)).status,401);assert.equal(retrieves,0);
});
test("fallback Stripe lookup cannot confirm an unrecorded session from another order",async()=>{
 const a=await bound(),b=await bound(),p=await pay(b.id,b.token);
 await db.paymentAttempt.updateMany({where:{orderId:b.id},data:{sessionId:null,sessionUrl:null}});
 await db.order.update({where:{id:b.id},data:{stripeSessionId:null}});
 Object.assign(remote.get(p.body.sessionId),{status:"complete",payment_status:"paid"});
 assert.equal((await confirm(p.body.sessionId,a.token)).status,401);
 assert.equal((await db.order.findUniqueOrThrow({where:{id:b.id}})).paymentStatus,"PENDING");
});
test("direct POST orders binds access without exposing credential or hash in response",async()=>{
 const p=await prepare(),key="guest_direct_order_synthetic",r=await create(p.body.accessToken,key,"/orders");
 assert.equal(r.status,201);assert.ok(!JSON.stringify(r.body).includes(p.body.accessToken));assert.ok(!JSON.stringify(r.body).includes(hash(p.body.accessToken)));
 assert.equal((await minimal(r.body.id,p.body.accessToken)).status,200);
 assert.deepEqual(await create(p.body.accessToken,key,"/orders"),r);
});
test("case-insensitive protected route aliases do not bypass token scope",async()=>{
 const a=await bound(),p=await pay(a.id,a.token);
 assert.equal((await request("/PAY/CONFIRM?session_id="+p.body.sessionId,{token:a.token})).status,200);
 app.locals.orderAccessRequired=true;assert.equal((await request("/ORDERS/"+a.id+"/MIN")).status,401);
});
test("bounded per-process access endpoint throttle returns 429",async()=>{
 const replies=[];for(let i=0;i<61;i++)replies.push(await prepare());
 assert.ok(replies.some(r=>r.status===429));assert.deepEqual(replies.at(-1).body,{error:"ORDER_ACCESS_RATE_LIMIT"});
});
