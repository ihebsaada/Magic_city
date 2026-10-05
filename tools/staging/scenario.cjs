const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),{createRequire}=require("node:module"),{randomUUID,createHmac}=require("node:crypto");
const dbUrl=new URL(process.env.DATABASE_URL);
assert.equal(dbUrl.hostname,"127.0.0.1");assert.equal(dbUrl.username,"magic_staging");assert.equal(dbUrl.pathname,"/magic_staging");
const requireBackend=createRequire(path.join(process.env.STAGING_BACKEND_ROOT,"package.json"));
const {PrismaClient}=requireBackend("@prisma/client"),db=new PrismaClient();
const API="http://127.0.0.1:4100",SIM="http://127.0.0.1:4101",STORE="http://127.0.0.1:5173",CHECKOUT="http://127.0.0.1:5174";
const results=[],tokens=[];
async function paymentProof(url){
 const page=await fetch(url);assert.equal(page.status,200);
 assert.equal(page.headers.get("referrer-policy"),"no-referrer");
 const html=await page.text(),match=html.match(/const proof=("[^"]+")/);
 assert.ok(match);const proof=JSON.parse(match[1]);tokens.push(proof);
 assert.ok(!html.includes("<form"));assert.ok(html.includes('mode:"cors"'));
 assert.match(page.headers.get("content-security-policy"),/connect-src 'self'/);
 return proof;
}
function completePayment(url,proof){return fetch(url+"/complete",{method:"POST",headers:{Origin:SIM,"Content-Type":"application/json","X-Simulator-Token":proof},body:"{}"});}
function syntheticProof(sessionId,expiresAt){
 assert.equal(process.env.STRIPE_WEBHOOK_SECRET,"synthetic-staging-webhook");
 const payload=Buffer.from(JSON.stringify({sessionId,expiresAt,nonce:randomUUID()})).toString("base64url");
 const proof=payload+"."+createHmac("sha256",process.env.STRIPE_WEBHOOK_SECRET).update("local-payment-page:"+payload).digest("base64url");
 tokens.push(proof);return proof;
}
async function check(name,run){try{await run();results.push({name,status:"PASS"});console.log("PASS "+name);}catch(e){results.push({name,status:"FAIL",error:e.code||e.name});throw e;}}
async function call(p,{method="GET",body,token,key,origin=CHECKOUT}={}){
 const r=await fetch(API+p,{method,headers:{"Content-Type":"application/json",Origin:origin,...(token?{"Order-Access-Token":token}:{}),...(key?{"Idempotency-Key":key}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
 return {status:r.status,body:await r.json(),headers:r.headers};
}
async function prepare(){const p=await call("/api/order-access/prepare",{method:"POST",body:{}});assert.equal(p.status,201);tokens.push(p.body.accessToken);return p.body.accessToken;}
const bodyFor=(p,size="M",color="Blue",discountCode)=>({customerName:"Synthetic Staging",customerEmail:"test@example.invalid",items:[{productId:p.id,quantity:1,selectedSize:size,selectedColor:color}],...(discountCode?{discountCode}:{}),shipping:{name:"Synthetic",address1:"Test Street 1",city:"Synthetic",zip:"00000",country:"IT"}});
async function create(p,discount){const token=await prepare(),key=randomUUID(),body=bodyFor(p,"M","Blue",discount),r=await call("/api/checkout/intent",{method:"POST",body,token,key,origin:STORE});assert.equal(r.status,201);return {token,key,body,id:r.body.orderId};}
async function pairing(a){const token=await prepare(),p=await call("/api/order-handoffs",{method:"POST",body:{orderId:a.id},token});assert.equal(p.status,200);return {token,id:p.body.pairingId,phrase:p.body.phrase};}
let product,a,b,payResult;
(async()=>{
 await check("launcher injects simulator capability into the real local development Checkout only",async()=>{
 const source=await(await fetch(CHECKOUT+"/src/lib/secureCheckout.ts")).text();
 assert.match(source,/"VITE_LOCAL_STRIPE_ORIGIN"\s*:\s*"http:\/\/127\.0\.0\.1:4101"/);
 assert.match(source,/"MODE"\s*:\s*"staging"/);
 assert.match(source,/"DEV"\s*:\s*true/);assert.match(source,/"PROD"\s*:\s*false/);
 const store=await(await fetch(STORE+"/src/services/api.ts")).text();
 assert.ok(!store.includes("VITE_LOCAL_STRIPE_ORIGIN"));
 });
 await check("two real local frontend origins and external-resource blocking headers",async()=>{for(const u of [STORE+"/catalog",CHECKOUT+"/checkout-landing"]){const r=await fetch(u);assert.equal(r.status,200);assert.equal(r.headers.get("referrer-policy"),"no-referrer");assert.match(r.headers.get("content-security-policy"),/default-src 'self'/);} for(const [url,value] of [[STORE+"/src/services/api.ts","http://127.0.0.1:4100/api"],[STORE+"/src/lib/handoffLink.ts","http://127.0.0.1:5174"],[CHECKOUT+"/src/lib/secureCheckout.ts","http://127.0.0.1:4100/api"]])assert.ok((await(await fetch(url)).text()).includes(value)); });
 await check("all additive migrations applied on isolated PostgreSQL",async()=>{const migrations=await db.$queryRawUnsafe('SELECT migration_name, finished_at FROM "_prisma_migrations" ORDER BY migration_name');assert.ok(migrations.every(m=>m.finished_at));assert.ok(migrations.some(m=>m.migration_name==="20261004230000_add_order_handoff"));});
 await check("catalog pagination >24, collection and exact variant stock/price",async()=>{const first=await call("/api/catalog/products?page=1&pageSize=24&collection=staging"),second=await call("/api/catalog/products?page=2&pageSize=24&collection=staging");assert.equal(first.body.items.length,24);assert.equal(second.body.items.length,16);assert.equal(first.body.pagination.total,40);product=first.body.items.find(p=>p.handle==="stage-001");assert.equal(product.variants.find(v=>v.option1==="M"&&v.option2==="Blue").price,11);assert.equal(product.variants.find(v=>v.option1==="L"&&v.option2==="Red").price,99.9);});
 await check("server discount preview EUR and stable idempotent concurrent creation",async()=>{
 const preview=await call("/api/discounts/preview",{method:"POST",body:{subtotal:11,discountCode:"STAGE10"}});assert.equal(preview.body.total,9.9);
 const token=await prepare(),key=randomUUID(),body=bodyFor(product,"M","Blue","STAGE10");
 const replies=await Promise.all([call("/api/checkout/intent",{method:"POST",token,key,body}),call("/api/checkout/intent",{method:"POST",token,key,body})]);assert.ok(replies.every(r=>r.status===201));assert.equal(replies[0].body.orderId,replies[1].body.orderId);a={token,key,body,id:replies[0].body.orderId};
 assert.equal((await db.order.findUniqueOrThrow({where:{id:a.id}})).total.toString(),"9.9");assert.equal((await db.variant.findFirstOrThrow({where:{productId:product.id,option1:"M"}})).reservedQuantity,1);assert.equal((await db.discount.findUniqueOrThrow({where:{code:"STAGE10"}})).reservedUses,1);
 });
 await check("automatic common-origin publication verifies initial access without pairing or new order",async()=>{
 const checkout=path.resolve(__dirname,"../../../Magic_city_checkout_security/seamless_checkout_flow"),store=path.resolve(__dirname,"../../drip_frontend");
 const compiler=createRequire(path.join(store,"package.json"))("esbuild");
 const env={MODE:"staging",DEV:true,PROD:false,VITE_COMMON_CHECKOUT_ENABLED:"true",VITE_ROUTER_BASENAME:"/checkout/",VITE_API_URL:API+"/api",VITE_PRIMARY_API_URL:API+"/api"};
 const data=new Map([["magic-city-drip-checkout-pending",JSON.stringify({version:1,checkoutMode:"common",state:"success",key:a.key,token:a.token,body:a.body,calls:1,result:{orderId:a.id,redirectUrl:CHECKOUT+"/checkout-landing?orderId="+a.id}})]]);
 const nativeFetch=fetch;
 async function module(file){
  const bundle=await compiler.build({entryPoints:[file],bundle:true,write:false,platform:"node",format:"cjs",define:{"import.meta.env":JSON.stringify(env)}});
  const context={module:{exports:{}},URL,Headers,AbortController,DOMException,setTimeout,clearTimeout,window:{location:{origin:STORE}},sessionStorage:{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)},fetch:(url,init={})=>nativeFetch(url,{...init,headers:{...Object.fromEntries(new Headers(init.headers)),Origin:STORE}})};
  require("node:vm").runInNewContext(bundle.outputFiles[0].text,context);return context.module.exports;
 }
 const publisher=await module(path.join(store,"src/lib/commonCheckout.ts")),client=await module(path.join(checkout,"src/lib/secureCheckout.ts"));
 const count=await db.order.count(),before=data.get("magic-city-drip-checkout-pending"),url=publisher.prepareCommonCheckout(a.id);
 assert.equal(url,"/checkout/checkout-landing?orderId="+a.id);assert.ok(!url.includes(a.token));
 publisher.prepareCommonCheckout(a.id);
 const min=await client.loadCommonOrder(a.id);assert.equal(min.id,a.id);assert.equal(min.total,9.9);
 assert.equal(data.get("magic-city-drip-checkout-pending"),before);assert.equal(await db.order.count(),count);
 assert.equal(await db.orderHandoff.count({where:{expectedOrderId:a.id}}),0);
 await assert.rejects(client.loadCommonOrder("synthetic-other-order"));
 const tokenHash=require("node:crypto").createHash("sha256").update(a.token).digest("hex");
 const grant=await db.guestOrderAccess.findUniqueOrThrow({where:{tokenHash}});
 try{
  await db.guestOrderAccess.update({where:{tokenHash},data:{expiresAt:new Date(0)}});
  await assert.rejects(client.loadCommonOrder(a.id));
  await db.guestOrderAccess.update({where:{tokenHash},data:{expiresAt:grant.expiresAt,revokedAt:new Date()}});
  await assert.rejects(client.loadCommonOrder(a.id));
 }finally{await db.guestOrderAccess.update({where:{tokenHash},data:{expiresAt:grant.expiresAt,revokedAt:grant.revokedAt}});}
 assert.equal((await client.loadCommonOrder(a.id)).id,a.id);
 });
 await check("automatic cross-origin source modules approve scoped recipient over real isolated HTTP without new order or payment",async()=>{
 const beforeOrders=await db.order.count(),beforePayments=await db.paymentAttempt.count();
 const token=await require('./automatic-handoff-http.cjs')({order:a,storeOrigin:STORE,checkoutOrigin:CHECKOUT,api:API+'/api'});tokens.push(token);
 assert.equal(await db.order.count(),beforeOrders);assert.equal(await db.paymentAttempt.count(),beforePayments);
 });
 await check("explicit authenticated pairing, scoped recipient and no URL token",async()=>{
 const p=await pairing(a);const inspect=await call("/api/orders/"+a.id+"/handoffs/"+p.id+"/inspect",{method:"POST",token:a.token,body:{},origin:STORE});assert.equal(inspect.body.phrase,p.phrase);
 const wrong=await call("/api/orders/"+a.id+"/handoffs/"+p.id+"/approve",{method:"POST",body:{},origin:STORE});assert.equal(wrong.status,401);
 const approved=await call("/api/orders/"+a.id+"/handoffs/"+p.id+"/approve",{method:"POST",token:a.token,body:{},origin:STORE});assert.equal(approved.body.state,"approved");
 assert.equal((await call("/api/order-handoffs/"+p.id+"/redeem",{method:"POST",token:p.token,body:{}})).body.state,"approved");a.checkoutToken=p.token;
 const min=await call("/api/orders/"+a.id+"/min",{token:p.token});assert.equal(min.body.total,9.9);assert.equal(min.body.currency,"EUR");
 assert.ok(!repliesContainToken(approved.body,p.token));
 });
 await check("Stripe lost creation response and concurrent /pay reuse one persistent local session",async()=>{
 await fetch(API+"/__staging/faults",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({stripeBefore:true})});
 const beforeLoss=await call("/api/pay",{method:"POST",body:{orderId:a.id},token:a.checkoutToken});assert.equal(beforeLoss.status,503);
 await fetch(API+"/__staging/faults",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({stripeAfter:true})});
 const lost=await call("/api/pay",{method:"POST",body:{orderId:a.id},token:a.checkoutToken});assert.equal(lost.status,503);
 const rs=await Promise.all([call("/api/pay",{method:"POST",body:{orderId:a.id},token:a.checkoutToken}),call("/api/pay",{method:"POST",body:{orderId:a.id},token:a.checkoutToken})]);assert.ok(rs.every(r=>r.status===200));assert.equal(rs[0].body.sessionId,rs[1].body.sessionId);payResult=rs[0].body;
 await fetch(API+"/__staging/faults",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({payAfter:true})});await assert.rejects(call("/api/pay",{method:"POST",body:{orderId:a.id},token:a.checkoutToken}));assert.equal((await call("/api/pay",{method:"POST",body:{orderId:a.id},token:a.checkoutToken})).body.sessionId,payResult.sessionId);
 assert.ok(payResult.url.startsWith(SIM+"/session/"));const stats=await(await fetch(SIM+"/__staging/stats")).json();assert.equal(stats.sessions,1);
 });
 await check("null-Origin remains denied; page uses scoped proof and explicit CORS fetch",async()=>{
 const page=await fetch(payResult.url);assert.equal(page.headers.get("referrer-policy"),"no-referrer");
 assert.ok(!(await page.text()).includes("<form"));
 const before=await db.paymentFinalization.count({where:{orderId:a.id}});
 const rejected=await fetch(SIM+"/session/"+payResult.sessionId+"/complete",{method:"POST",headers:{Origin:"null"}});
 assert.equal(rejected.status,403);assert.equal((await rejected.json()).error,"STAGING_ORIGIN_DENIED");
 assert.equal(await db.paymentFinalization.count({where:{orderId:a.id}}),before);
 });
 await check("completion rejects absent, wrong or null origins and absent, forged or cross-session proofs",async()=>{
 const proof=await paymentProof(payResult.url);
 for(const origin of [undefined,"null",STORE,CHECKOUT,"http://localhost:4101",SIM+".evil","http://127.0.0.1:4102"]){
  const response=await fetch(payResult.url+"/complete",{method:"POST",headers:{"Content-Type":"application/json","X-Simulator-Token":proof,...(origin?{Origin:origin}:{})},body:"{}"});
  assert.equal(response.status,403);assert.equal((await response.json()).error,"STAGING_ORIGIN_DENIED");
 }
 for(const badProof of ["",proof+"tampered"]){const r=await completePayment(payResult.url,badProof);assert.equal(r.status,403);assert.equal((await r.json()).error,"SIMULATOR_SESSION_DENIED");}
 const other=await completePayment(SIM+"/session/cs_stage_unknown",proof);assert.equal(other.status,403);
 assert.equal((await fetch(SIM+"/session/cs_stage_unknown")).status,404);
 const unknown=await completePayment(SIM+"/session/cs_stage_unknown",syntheticProof("cs_stage_unknown",Date.now()+60000));assert.equal(unknown.status,404);
 const expired=await completePayment(payResult.url,syntheticProof(payResult.sessionId,0));assert.equal(expired.status,403);
 assert.equal(await db.paymentFinalization.count({where:{orderId:a.id}}),0);
 });
 await check("signed webhook and concurrent confirmation finalize exactly once",async()=>{
 const proof=await paymentProof(payResult.url);
 const completions=[completePayment(payResult.url,proof),completePayment(payResult.url,proof)];
 const confirmation=call("/api/pay/confirm?session_id="+payResult.sessionId,{token:a.checkoutToken});
 const completed=await Promise.all(completions);assert.ok(completed.every(r=>r.status===200));await confirmation;
 const confirmed=await call("/api/pay/confirm?session_id="+payResult.sessionId,{token:a.checkoutToken});assert.equal(confirmed.body.paid,true);
 const v=await db.variant.findFirstOrThrow({where:{productId:product.id,option1:"M"}}),d=await db.discount.findUniqueOrThrow({where:{code:"STAGE10"}});
 assert.equal(v.inventoryQuantity,4);assert.equal(v.reservedQuantity,0);assert.equal(d.usageCount,1);assert.equal(d.reservedUses,0);assert.equal(await db.paymentFinalization.count({where:{orderId:a.id}}),1);
 assert.equal((await call("/api/orders/"+a.id+"/min",{token:a.token})).body.paymentStatus,"PAID");const recipientMin=await call("/api/orders/"+a.id+"/min",{token:a.checkoutToken});assert.equal(recipientMin.body.paymentStatus,"PAID");assert.equal(recipientMin.body.total,9.9);assert.equal(recipientMin.body.currency,"EUR");
 });
 await check("lost simulator completion response reuses session and proof without a second finalization",async()=>{
 const proof=await paymentProof(payResult.url);
 const before=await db.discount.findUniqueOrThrow({where:{code:"STAGE10"}});
 const stockBefore=await db.variant.findFirstOrThrow({where:{productId:product.id,option1:"M"}});
 await fetch(API+"/__staging/faults",{method:"POST",headers:{Origin:STORE,"Content-Type":"application/json"},body:JSON.stringify({simCompleteAfter:true})});
 await assert.rejects(completePayment(payResult.url,proof));
 const retry=await completePayment(payResult.url,proof);assert.equal(retry.status,200);
 assert.equal((await retry.json()).redirect,new URL("/order-confirmation?orderId="+encodeURIComponent(a.id)+"&session_id="+payResult.sessionId,CHECKOUT).href);
 assert.equal(await db.paymentFinalization.count({where:{orderId:a.id}}),1);
 assert.equal((await db.discount.findUniqueOrThrow({where:{code:"STAGE10"}})).usageCount,before.usageCount);
 const stockAfter=await db.variant.findFirstOrThrow({where:{productId:product.id,option1:"M"}});
 assert.equal(stockAfter.inventoryQuantity,stockBefore.inventoryQuantity);
 assert.equal(stockAfter.reservedQuantity,stockBefore.reservedQuantity);
 assert.equal((await(await fetch(SIM+"/__staging/stats")).json()).sessions,1);
 });
 await check("repeated and late expiration webhooks do not regress paid stock/discount",async()=>{for(const type of ["checkout.session.completed","checkout.session.completed","checkout.session.expired"]){const r=await fetch(SIM+"/session/"+payResult.sessionId+"/event",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({type})});assert.equal(r.status,200);}assert.equal((await db.order.findUniqueOrThrow({where:{id:a.id}})).paymentStatus,"PAID");assert.equal((await db.discount.findUniqueOrThrow({where:{code:"STAGE10"}})).usageCount,1);assert.equal((await call("/api/pay",{method:"POST",body:{orderId:a.id},token:a.checkoutToken})).status,409);});
 await check("actual Checkout module accepts configured local payment, persists session and confirms EUR over real HTTP",async()=>{
 const checkout=path.resolve(__dirname,"../../../Magic_city_checkout_security/seamless_checkout_flow");
 const req=createRequire(path.join(checkout,"package.json"));
 const source=await req("esbuild").build({entryPoints:[path.join(checkout,"src/lib/secureCheckout.ts")],bundle:true,write:false,platform:"node",format:"cjs",define:{"import.meta.env":JSON.stringify({MODE:"staging",DEV:true,PROD:false,VITE_PRIMARY_API_URL:API+"/api",VITE_LOCAL_STRIPE_ORIGIN:SIM})}});
 const data=new Map(),nativeFetch=fetch;
 const context={module:{exports:{}},URL,AbortController,DOMException,setTimeout,clearTimeout,window:{location:{origin:CHECKOUT}},sessionStorage:{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)},fetch:(url,init={})=>nativeFetch(url,{...init,headers:{...init.headers,Origin:CHECKOUT}})};
 require("node:vm").runInNewContext(source.outputFiles[0].text,context);
 const client=context.module.exports;
 const p=await db.product.findUniqueOrThrow({where:{handle:"stage-002"}});
 const order=await create(p,"STAGE10");
 const pairing=await client.preparePairing(order.id);
 tokens.push(client.readAttempt(order.id).token);
 const approved=await call("/api/orders/"+order.id+"/handoffs/"+pairing.pairingId+"/approve",{method:"POST",token:order.token,body:{},origin:STORE});
 assert.equal(approved.body.state,"approved");await client.checkPairing(order.id);
 const paidSession=await client.pay(order.id);
 assert.equal(new URL(paidSession.url).origin,SIM);
 assert.equal(client.readAttempt(order.id).sessionId,paidSession.sessionId);
 assert.equal((await client.pay(order.id)).sessionId,paidSession.sessionId);
 const proof=await paymentProof(paidSession.url);
 assert.ok((await completePayment(paidSession.url,proof)).ok);
 assert.equal((await client.confirm(order.id,paidSession.sessionId)).paid,true);
 const min=await client.readOrder(order.id);assert.equal(min.total,9.9);assert.equal(min.currency,"EUR");assert.equal(min.paymentStatus,"PAID");
 assert.equal(await db.paymentFinalization.count({where:{orderId:order.id}}),1);
 assert.equal((await db.discount.findUniqueOrThrow({where:{code:"STAGE10"}})).usageCount,2);
 });
 await check("lost committed order response replays same key, body and token",async()=>{const token=await prepare(),key=randomUUID(),body=bodyFor(product);await fetch(API+"/__staging/faults",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({intentAfter:true})});await assert.rejects(call("/api/checkout/intent",{method:"POST",token,key,body}));const rs=await Promise.all([call("/api/checkout/intent",{method:"POST",token,key,body}),call("/api/checkout/intent",{method:"POST",token,key,body})]);assert.equal(rs[0].body.orderId,rs[1].body.orderId);b={token,key,body,id:rs[0].body.orderId};});
 await check("before-create network loss leaves no claim and explicit same-key retry works",async()=>{const token=await prepare(),key=randomUUID(),body=bodyFor(product);const n=await db.order.count();await fetch(API+"/__staging/faults",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({intentBefore:true})});await assert.rejects(call("/api/checkout/intent",{method:"POST",token,key,body}));assert.equal(await db.order.count(),n);assert.equal((await call("/api/checkout/intent",{method:"POST",token,key,body})).status,201);});
 await check("cross-order access, wrong origin and missing-token approval are denied",async()=>{assert.equal((await call("/api/orders/"+a.id+"/min",{token:b.token})).status,401);assert.equal((await call("/api/pay/confirm?session_id="+payResult.sessionId,{token:b.token})).status,401);const t=await prepare();const r=await call("/api/order-handoffs",{method:"POST",body:{orderId:b.id},token:t,origin:CHECKOUT+".evil"});assert.equal(r.status,403);assert.equal(r.headers.get("cache-control"),"no-store");const control=await call("/__staging/faults",{method:"POST",body:{stripeAfter:true},origin:"https://external.example.invalid"});assert.equal(control.status,403);});
 await check("expired and revoked pairing cannot authorize",async()=>{const p=await pairing(b);await db.orderHandoff.update({where:{id:p.id},data:{expiresAt:new Date(0)}});assert.equal((await call("/api/order-handoffs/"+p.id+"/redeem",{method:"POST",token:p.token,body:{}})).status,410);const q=await pairing(b);await db.orderHandoff.update({where:{id:q.id},data:{revokedAt:new Date()}});assert.equal((await call("/api/orders/"+b.id+"/handoffs/"+q.id+"/approve",{method:"POST",token:b.token,body:{},origin:STORE})).status,401);});
 await check("last exact unit concurrent reservations have one winner",async()=>{const p=await db.product.findUniqueOrThrow({where:{handle:"stage-040"}}),tokens=await Promise.all([prepare(),prepare()]);const rs=await Promise.all(tokens.map(token=>call("/api/checkout/intent",{method:"POST",token,key:randomUUID(),body:bodyFor(p)})));assert.equal(rs.filter(r=>r.status===201).length,1);assert.equal(rs.filter(r=>r.status===409).length,1);});
 await check("last discount use reserved atomically on different variants",async()=>{const products=await db.product.findMany({where:{handle:{in:["stage-038","stage-039"]}},orderBy:{id:"asc"}}),tokens=await Promise.all([prepare(),prepare()]);const rs=await Promise.all(products.map((p,i)=>call("/api/checkout/intent",{method:"POST",token:tokens[i],key:randomUUID(),body:bodyFor(p,"M","Blue","STAGE-LAST")})));assert.equal(rs.filter(r=>r.status===201).length,1);assert.equal(rs.filter(r=>r.status===409).length,1);});
 await check("historical order remains unchanged and cannot pay without reservation",async()=>{const old=await call("/api/orders/stage-legacy/min");assert.equal(old.body.total,12.34);const payment=await call("/api/pay",{method:"POST",body:{orderId:"stage-legacy"}});assert.equal(payment.status,409);assert.equal(payment.body.error,"LEGACY_RESERVATION_REVIEW");assert.equal((await call("/api/orders")).status,401);});
 await check("signature errors and secrets in URL are rejected without exposing credentials",async()=>{const r=await fetch(API+"/api/stripe/webhook",{method:"POST",headers:{"Content-Type":"application/json","Stripe-Signature":"invalid"},body:"{}"});assert.equal(r.status,400);const q=await call("/api/orders/"+a.id+"/min?accessToken=synthetic",{token:a.token});assert.equal(q.status,400);assert.ok(!JSON.stringify(q.body).includes(a.token));});
 await check("expired unpaid simulator session cannot be paid with a valid page proof",async()=>{
 const p=await db.product.findUniqueOrThrow({where:{handle:"stage-037"}});
 const order=await create(p);
 const payment=await call("/api/pay",{method:"POST",body:{orderId:order.id},token:order.token});assert.equal(payment.status,200);
 const rows=await db.$queryRawUnsafe('SELECT payload FROM staging_simulator.sessions WHERE id=$1',payment.body.sessionId);
 const session=rows[0].payload;session.expires_at=1;
 await db.$executeRawUnsafe('UPDATE staging_simulator.sessions SET payload=$2::jsonb WHERE id=$1',session.id,JSON.stringify(session));
 const proof=await paymentProof(payment.body.url),response=await completePayment(payment.body.url,proof);
 assert.equal(response.status,409);assert.equal((await response.json()).error,"SIMULATED_SESSION_EXPIRED");
 assert.equal(await db.paymentFinalization.count({where:{orderId:order.id}}),0);
 });

 await check("common Checkout real HTTP payment resumes lost responses and confirms same session under prefix",async()=>{
 const checkout=path.resolve(__dirname,"../../../Magic_city_checkout_security/seamless_checkout_flow"),compiler=createRequire(path.join(checkout,"package.json"))("esbuild");
 const env={MODE:"staging",DEV:true,PROD:false,VITE_COMMON_CHECKOUT_ENABLED:"true",VITE_ROUTER_BASENAME:"/checkout/",VITE_LOCAL_STRIPE_ORIGIN:SIM,VITE_PRIMARY_API_URL:API+"/api"};
 const p=await db.product.findUniqueOrThrow({where:{handle:"stage-035"}});
 await db.discount.create({data:{code:"STAGE-COMMON",type:"PERCENTAGE",value:"10",usageLimit:1}});
 const order=await create(p,"STAGE-COMMON"),data=new Map([["magic-city-common-checkout-v1:"+order.id,JSON.stringify({version:1,orderId:order.id,token:order.token,attemptKey:order.key})]]),nativeFetch=fetch;
 const source=await compiler.build({entryPoints:[path.join(checkout,"src/lib/secureCheckout.ts")],bundle:true,write:false,platform:"node",format:"cjs",define:{"import.meta.env":JSON.stringify(env)}});
 function client(){const context={module:{exports:{}},URL,AbortController,DOMException,setTimeout,clearTimeout,window:{location:{origin:STORE}},sessionStorage:{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)},fetch:(url,init={})=>nativeFetch(url,{...init,headers:{...init.headers,Origin:STORE}})};require("node:vm").runInNewContext(source.outputFiles[0].text,context);return context.module.exports;}
 let c=client();await c.loadCommonOrder(order.id);
 await call("/__staging/faults",{method:"POST",body:{stripeAfter:true},origin:STORE});await assert.rejects(c.pay(order.id));
 await call("/__staging/faults",{method:"POST",body:{payAfter:true},origin:STORE});await assert.rejects(c.pay(order.id));
 c=client();const rs=await Promise.all([c.pay(order.id),c.pay(order.id)]),payment=rs[0];assert.equal(rs[1].sessionId,payment.sessionId);assert.equal(c.readAttempt(order.id).sessionId,payment.sessionId);
 const rows=await db.$queryRawUnsafe('SELECT payload FROM staging_simulator.sessions WHERE id=$1',payment.sessionId);assert.equal(rows[0].payload.stagingReturnBase,STORE+"/checkout/order-confirmation");
 const wrong=await call("/api/pay",{method:"POST",body:{orderId:order.id},token:order.token,origin:CHECKOUT});assert.equal(wrong.status,409);assert.equal(wrong.body.error,"STAGING_RETURN_CONFLICT");
 const proof=await paymentProof(payment.url);await call("/__staging/faults",{method:"POST",body:{simCompleteAfter:true},origin:STORE});await assert.rejects(completePayment(payment.url,proof));
 const [r,confirmation]=await Promise.all([completePayment(payment.url,proof),c.confirm(order.id,payment.sessionId)]);const result=await r.json();assert.equal(result.redirect,STORE+"/checkout/order-confirmation?orderId="+order.id+"&session_id="+payment.sessionId);assert.equal(confirmation.paid,true);
 assert.equal((await c.readOrder(order.id)).paymentStatus,"PAID");assert.equal((await c.readOrder(order.id)).total,9.9);
 await assert.rejects(c.confirm(order.id,"cs_stage_wrong"));assert.equal((await client().confirm(order.id,payment.sessionId)).paid,true);
 await completePayment(payment.url,proof);assert.equal(await db.paymentFinalization.count({where:{orderId:order.id}}),1);
 const v=await db.variant.findFirstOrThrow({where:{productId:p.id,option1:"M"}});assert.equal(v.inventoryQuantity,4);assert.equal(v.reservedQuantity,0);assert.equal((await db.discount.findUniqueOrThrow({where:{code:"STAGE-COMMON"}})).usageCount,1);
 assert.equal(await db.orderHandoff.count({where:{expectedOrderId:order.id}}),0);
 });

 await check("historical paid and expired sessions retain original request, key and return route",async()=>{
 const sessions=await db.$queryRawUnsafe('SELECT id,key,request,payload FROM staging_simulator.sessions ORDER BY id');
 const paid=sessions.find(row=>row.payload.id===payResult.sessionId);assert.ok(paid);assert.equal(paid.payload.currency,'eur');assert.equal(paid.payload.amount_total,990);assert.equal(paid.payload.stagingReturnBase,CHECKOUT+'/order-confirmation');
 const attempt=await db.paymentAttempt.findFirstOrThrow({where:{sessionId:paid.id}});assert.equal(attempt.idempotencyKey,paid.key);assert.equal(attempt.amountCents,990);assert.equal(attempt.currency,'eur');assert.equal(attempt.request.success_url,paid.request.success_url);assert.ok(paid.request.success_url.startsWith(CHECKOUT+'/order-confirmation'));
 const before=JSON.stringify(sessions);const proof=await paymentProof(paid.payload.url),repeated=await completePayment(paid.payload.url,proof);assert.equal((await repeated.json()).redirect,CHECKOUT+'/order-confirmation?orderId='+a.id+'&session_id='+paid.id);
 await call('/api/pay/confirm?session_id='+paid.id,{token:a.checkoutToken});
 const expired=sessions.find(row=>row.payload.expires_at===1);assert.ok(expired);assert.equal(expired.payload.payment_status,'unpaid');assert.equal(expired.payload.stagingReturnBase,CHECKOUT+'/order-confirmation');
 const denied=await completePayment(expired.payload.url,await paymentProof(expired.payload.url));assert.equal(denied.status,409);assert.equal(await db.paymentFinalization.count({where:{orderId:expired.payload.metadata.order_id}}),0);
 assert.equal(JSON.stringify(await db.$queryRawUnsafe('SELECT id,key,request,payload FROM staging_simulator.sessions ORDER BY id')),before);
 });
 await check("compatibility inventory is synthetic and contains no credentials or customer data",async()=>{
 const rows=await db.$queryRawUnsafe('SELECT payload FROM staging_simulator.sessions');const tally={historical:0,common:0,open:0,complete:0,expiredOrPastDeadline:0};
 for(const {payload:s} of rows){if(s.stagingReturnBase===STORE+'/checkout/order-confirmation')tally.common++;else tally.historical++;if(s.status==='open')tally.open++;if(s.status==='complete')tally.complete++;if(s.status==='expired'||s.expires_at*1000<=Date.now())tally.expiredOrPastDeadline++;}
 const inventory={syntheticOnly:true,browserStorageInventoried:false,orders:await db.order.groupBy({by:['paymentStatus','status'],_count:true}),sessions:tally,idempotencyClaims:await db.orderIdempotency.count(),paymentAttempts:await db.paymentAttempt.count(),guestGrants:await db.guestOrderAccess.count(),handoffs:await db.orderHandoff.count()};
 fs.writeFileSync(path.join(__dirname,'COMPATIBILITY_INVENTORY.json'),JSON.stringify(inventory,null,2));
 });
 await check("strict CORS preflight and per-process handoff rate limit",async()=>{const preflight=await fetch(API+"/api/order-handoffs",{method:"OPTIONS",headers:{Origin:CHECKOUT,"Access-Control-Request-Method":"POST","Access-Control-Request-Headers":"Order-Access-Token,Content-Type"}});assert.equal(preflight.status,204);assert.equal(preflight.headers.get("access-control-allow-origin"),CHECKOUT);let limited=false;for(let i=0;i<65;i++){const r=await call("/api/order-handoffs",{method:"POST",body:{orderId:a.id}});if(r.status===429){limited=true;assert.equal(r.headers.get("retry-after"),"60");break;}}assert.ok(limited);});
 await check("application staging logs never contain generated access tokens",async()=>{fs.writeFileSync(path.join(process.env.STAGING_RUNTIME,"scenario-private.json"),JSON.stringify({a,b,payResult}),{mode:0o600});const forbidden="/@fs/"+path.join(process.env.STAGING_RUNTIME,"scenario-private.json").replaceAll("\\","/");for(const origin of [STORE,CHECKOUT]){const response=await fetch(origin+forbidden);assert.ok([403,404].includes(response.status),"Private artifact HTTP status "+response.status);const text=await response.text();assert.ok(tokens.every(t=>!text.includes(t)));}
 const logs=fs.readdirSync(process.env.STAGING_RUNTIME).filter(p=>p.endsWith(".log")).map(p=>fs.readFileSync(path.join(process.env.STAGING_RUNTIME,p),"utf8")).join("\n");assert.ok(tokens.every(t=>!logs.includes(t)));});
 fs.writeFileSync(path.join(process.env.STAGING_RUNTIME,"scenario-private.json"),JSON.stringify({a,b,payResult}),{mode:0o600});
 console.log("PASS "+results.length+" API staging checks; browser and UI Stripe navigation NOT VALIDATED.");
})().catch(error=>{console.error("Staging verification failed: "+error.name);process.exitCode=1;}).finally(async()=>{fs.writeFileSync(path.join(__dirname,"STAGING_RESULTS.json"),JSON.stringify({date:new Date().toISOString(),results,browserExecuted:false,localStripeNavigation:"POLICY_AND_REAL_HTTP_MODULE_VALIDATED_NOT_BROWSER"},null,2));await db.$disconnect();});
function repliesContainToken(value,token){return JSON.stringify(value).includes(token);}
