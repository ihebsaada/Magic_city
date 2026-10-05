const {test,before,after}=require("node:test");
const assert=require("node:assert/strict");
const {createHash}=require("node:crypto");
const {PrismaClient}=require("@prisma/client");
const db=new PrismaClient();
let stripeCalls=0;const sessions=new Map();class StripeFake{constructor(){this.checkout={sessions:{create:async p=>{stripeCalls++;const session={id:"cs_bridge_"+stripeCalls,url:"https://checkout.stripe.com/c/pay/synthetic",mode:"payment",status:"open",payment_status:"unpaid",metadata:p.metadata,amount_total:p.line_items[0].price_data.unit_amount,currency:p.line_items[0].price_data.currency};sessions.set(session.id,session);return session;},retrieve:async id=>sessions.get(id)}};}}
require.cache[require.resolve("stripe")]={exports:StripeFake};
const {createApp}=require("../dist/app"),shared=require("../dist/prisma").default;
let server,base;
const origins={store:"https://store.example.invalid",checkout:"https://checkout.example.invalid"};
async function restart(){if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}server=createApp({logging:false,handoffOrigins:origins}).listen(0,"127.0.0.1");await new Promise(r=>server.once("listening",r));base="http://127.0.0.1:"+server.address().port+"/api";}
before(async()=>{assert.equal(new URL(process.env.DATABASE_URL).hostname,"127.0.0.1");await restart();});
after(async()=>{await db.orderHandoff.deleteMany();server.closeAllConnections();await new Promise(r=>server.close(r));await db.$disconnect();await shared.$disconnect();});
const hash=t=>createHash("sha256").update(t).digest("hex");
async function req(path,token,body={},origin=origins.checkout,method="POST"){const r=await fetch(base+path,{method,headers:{"Content-Type":"application/json",Origin:origin,...(token?{"Order-Access-Token":token}:{})},body:method==="OPTIONS"||method==="GET"?undefined:JSON.stringify(body)});assert.equal(r.headers.get("cache-control"),"no-store");return {status:r.status,body:r.status===204?{}:await r.json(),headers:r.headers};}
async function prepare(){const r=await req("/order-access/prepare");assert.equal(r.status,201);return r.body.accessToken;}
async function fixture(){const source=await prepare(),recipient=await prepare();const order=await db.order.create({data:{customerName:"Bridge synthetic",customerEmail:"bridge@example.invalid",total:"99.90"}});await db.guestOrderAccess.update({where:{tokenHash:hash(source)},data:{orderId:order.id}});return {source,recipient,id:order.id};}
const pair=f=>req("/order-handoffs",f.recipient,{orderId:f.id});
const action=(f,id,type="approve",token=f.source,order=f.id)=>req("/orders/"+order+"/handoffs/"+id+"/"+type,token,{},origins.store);
const redeem=(f,id,token=f.recipient)=>req("/order-handoffs/"+id+"/redeem",token);
test("prepared credential never grants access before explicit approval; matching phrase and scoped grant afterwards",async()=>{const f=await fixture(),p=await pair(f);assert.equal(p.status,200);assert.equal((await redeem(f,p.body.pairingId)).body.state,"pending");const peek=await action(f,p.body.pairingId,"inspect");assert.equal(peek.body.phrase,p.body.phrase);assert.equal((await db.guestOrderAccess.findUnique({where:{tokenHash:hash(f.recipient)}})).orderId,null);await action(f,p.body.pairingId);assert.equal((await redeem(f,p.body.pairingId)).body.state,"approved");assert.equal((await db.guestOrderAccess.findUnique({where:{tokenHash:hash(f.recipient)}})).orderId,f.id);});
test("same prepared grant and request is stable through simultaneous creation and restart",async()=>{const f=await fixture(),rs=await Promise.all([pair(f),pair(f)]);assert.equal(rs[0].body.pairingId,rs[1].body.pairingId);await restart();assert.equal((await pair(f)).body.pairingId,rs[0].body.pairingId);assert.equal((await req("/order-handoffs",f.recipient,{orderId:"another"})).status,409);});
test("concurrent approvals and lost response replay bind only once",async()=>{const f=await fixture(),p=await pair(f),id=p.body.pairingId;const rs=await Promise.all([action(f,id),action(f,id)]);assert.ok(rs.every(r=>r.status===200));const expiration=(await db.guestOrderAccess.findUnique({where:{tokenHash:hash(f.recipient)}})).expiresAt;await action(f,id);assert.equal((await db.guestOrderAccess.findUnique({where:{tokenHash:hash(f.recipient)}})).expiresAt.getTime(),expiration.getTime());await restart();assert.equal((await redeem(f,id)).body.state,"approved");});
test("pairing ID, order ID and forged recipient cannot authorize approval or redemption",async()=>{const f=await fixture(),other=await fixture(),p=await pair(f),id=p.body.pairingId;assert.equal((await action(f,id,"approve",undefined,"wrong")).status,401);assert.equal((await action(f,id,"approve",other.source)).status,401);assert.equal((await redeem(f,id,other.recipient)).status,401);assert.equal((await req("/orders/"+f.id+"/handoffs/"+id+"/approve",null,{},origins.store)).status,401);});
test("strict Origin and CORS preflight reject lookalikes and null",async()=>{const f=await fixture();for(const o of ["null",origins.checkout+".evil","https://evil.example.invalid"])assert.equal((await req("/order-handoffs",f.recipient,{orderId:f.id},o)).status,403);const r=await req("/order-handoffs",null,{},origins.checkout,"OPTIONS");assert.equal(r.status,204);assert.equal(r.headers.get("access-control-allow-origin"),origins.checkout);assert.notEqual(r.headers.get("access-control-allow-origin"),"*");});
test("expired pending pairing cannot bind; approved grant survives pairing window without extending access",async()=>{const f=await fixture(),p=await pair(f),id=p.body.pairingId;await db.orderHandoff.update({where:{id},data:{expiresAt:new Date(0)}});assert.equal((await action(f,id)).status,410);assert.equal((await redeem(f,id)).status,410);const g=await fixture(),q=await pair(g);await action(g,q.body.pairingId);await db.orderHandoff.update({where:{id:q.body.pairingId},data:{expiresAt:new Date(0)}});assert.equal((await redeem(g,q.body.pairingId)).status,200);});
test("revocation invalidates both pending and approved bridge even after restart",async()=>{const {revokeGuestAccess}=require("../dist/services/guestOrderAccess");const f=await fixture(),p=await pair(f);await action(f,p.body.pairingId);await revokeGuestAccess(f.id);await restart();assert.equal((await redeem(f,p.body.pairingId)).status,401);const g=await fixture(),q=await pair(g);await revokeGuestAccess(g.id);assert.equal((await action(g,q.body.pairingId)).status,401);});
test("expired or revoked prepared grants and raw secrets in URLs are rejected",async()=>{const f=await fixture();await db.guestOrderAccess.update({where:{tokenHash:hash(f.recipient)},data:{revokedAt:new Date()}});assert.equal((await pair(f)).status,401);assert.equal((await req("/order-handoffs?accessToken=synthetic",f.recipient,{orderId:f.id})).status,400);});
test("unknown orders create no readable access and leave historical orders unchanged",async()=>{const token=await prepare(),r=await req("/order-handoffs",token,{orderId:"not-existing"});assert.equal(r.status,200);assert.equal((await req("/orders/not-existing/handoffs/"+r.body.pairingId+"/approve",token,{},origins.store)).status,401);const old=await db.order.findUniqueOrThrow({where:{id:"legacy-before-migration"}});assert.equal(Number(old.total),12.34);const rows=await db.orderHandoff.findMany();assert.ok(!JSON.stringify(rows).includes(token));});

test("bridge grants preserve PostgreSQL reservations, one Stripe attempt and confirmation isolation",async()=>{
 const source=await prepare(),recipient=await prepare();
 const product=await db.product.create({data:{handle:"bridge-payment-synthetic",title:"Bridge payment",variants:{create:{price:"99.90",inventoryQuantity:3}}}});
 const created=await req("/checkout/intent",source,{customerName:"Synthetic",customerEmail:"bridge-payment@example.invalid",items:[{productId:product.id,quantity:1}]});
 assert.equal(created.status,201);const f={id:created.body.orderId,source,recipient},p=await pair(f);await action(f,p.body.pairingId);await redeem(f,p.body.pairingId);
 const paid=await Promise.all([req("/pay",recipient,{orderId:f.id}),req("/pay",recipient,{orderId:f.id})]);assert.ok(paid.every(r=>r.status===200));assert.equal(paid[0].body.sessionId,paid[1].body.sessionId);assert.equal(stripeCalls,1);
 const sessionId=paid[0].body.sessionId;sessions.get(sessionId).payment_status="paid";sessions.get(sessionId).status="complete";
 const result=await req("/pay/confirm?session_id="+sessionId,recipient,{},origins.checkout,"GET");assert.equal(result.status,200);assert.equal(result.body.paid,true);
 const other=await fixture();assert.equal((await req("/pay/confirm?session_id="+sessionId,other.source,{},origins.checkout,"GET")).status,401);
 assert.equal((await db.variant.findFirstOrThrow({where:{productId:product.id}})).inventoryQuantity,2);
 assert.equal(await db.paymentFinalization.count({where:{orderId:f.id}}),1);
});
test("mixed-case endpoints enforce same strict origin policy",async()=>{const f=await fixture();assert.equal((await req("/ORDER-HANDOFFS",f.recipient,{orderId:f.id},"https://evil.example.invalid")).status,403);});
test("verified recovery atomically revokes all approved and pending handoffs",async()=>{
 const {requestGuestRecovery,redeemGuestRecovery}=require("../dist/services/guestOrderAccess");
 const f=await fixture(),p=await pair(f);await action(f,p.body.pairingId);
 let delivered;await requestGuestRecovery(f.id,"bridge@example.invalid",async m=>{delivered=m;});
 assert.ok(delivered);await redeemGuestRecovery(delivered.recoveryToken);
 assert.equal((await redeem(f,p.body.pairingId)).status,401);
});
test("approval racing revocation cannot resurrect a revoked access",async()=>{
 const {revokeGuestAccess}=require("../dist/services/guestOrderAccess"),f=await fixture(),p=await pair(f);
 await Promise.all([action(f,p.body.pairingId),revokeGuestAccess(f.id)]);
 assert.equal((await redeem(f,p.body.pairingId)).status,401);
});

test("failure after recipient binding rolls back the whole approval and retry succeeds",async()=>{
 const f=await fixture(),p=await pair(f),id=p.body.pairingId;
 await db.$executeRawUnsafe('CREATE FUNCTION synthetic_handoff_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION \'synthetic failure\'; END $$');
 await db.$executeRawUnsafe('CREATE TRIGGER synthetic_handoff_failure BEFORE UPDATE ON "OrderHandoff" FOR EACH ROW EXECUTE FUNCTION synthetic_handoff_failure()');
 try {assert.equal((await action(f,id)).status,503);assert.equal((await db.guestOrderAccess.findUniqueOrThrow({where:{tokenHash:hash(f.recipient)}})).orderId,null);}
 finally {await db.$executeRawUnsafe('DROP TRIGGER synthetic_handoff_failure ON "OrderHandoff"');await db.$executeRawUnsafe('DROP FUNCTION synthetic_handoff_failure()');}
 // Direct service retry avoids per-IP throttle interference with this fault injection.
 const {approveHandoff}=require("../dist/services/orderHandoff");assert.equal((await approveHandoff(f.id,id,f.source,true)).state,"approved");
});
test("PostgreSQL uniqueness prevents binding the same recipient through another pairing",async()=>{
 const f=await fixture(),{createHandoff}=require("../dist/services/orderHandoff");await createHandoff(f.id,f.recipient,origins.checkout);
 await assert.rejects(db.orderHandoff.create({data:{id:"synthetic-duplicate",expectedOrderId:f.id,recipientHash:hash(f.recipient),origin:origins.checkout,expiresAt:new Date(Date.now()+300000)}}),e=>e.code==="P2002");
});
