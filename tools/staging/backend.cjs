const path=require("node:path"),{createRequire}=require("node:module"),{randomUUID,randomBytes,createHmac,timingSafeEqual}=require("node:crypto");
const root=process.env.STAGING_BACKEND_ROOT;
const url=new URL(process.env.DATABASE_URL);
if(url.hostname!=="127.0.0.1"||url.username!=="magic_staging"||url.pathname!=="/magic_staging")throw new Error("Non-staging database refused");
const requireBackend=createRequire(path.join(root,"package.json"));
const {PrismaClient}=requireBackend("@prisma/client"),db=new PrismaClient();
const RealStripe=requireBackend("stripe"),signer=new RealStripe("sk_test_synthetic_not_a_real_key");
const localFetch=globalThis.fetch;
globalThis.fetch=(target,options)=>{const u=new URL(target);if(u.hostname!=="127.0.0.1")throw new Error("External network forbidden");return localFetch(target,options);};
const faults={};
const paymentContext=new (require("node:async_hooks").AsyncLocalStorage)();
function returnBase(s){return s.stagingReturnBase==="http://127.0.0.1:5173/checkout/order-confirmation"?s.stagingReturnBase:"http://127.0.0.1:5174/order-confirmation";}
async function getSession(id){const rows=await db.$queryRawUnsafe('SELECT payload FROM staging_simulator.sessions WHERE id=$1',id);if(!rows.length)throw new Error("Synthetic session missing");return rows[0].payload;}
class LocalStripe{
 constructor(){
  this.checkout={sessions:{
   create:async(p,o)=>{
    if(faults.stripeBefore){delete faults.stripeBefore;throw new Error("synthetic timeout before Stripe creation");}
    const session=await db.$transaction(async tx=>{
     await tx.$queryRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))::text',o.idempotencyKey);
     const rows=await tx.$queryRawUnsafe('SELECT payload, request FROM staging_simulator.sessions WHERE key=$1',o.idempotencyKey);
     if(rows.length){if(JSON.stringify(rows[0].request)!==JSON.stringify(JSON.parse(JSON.stringify(p)))) {
       // JSONB key order is not significant.
       const canonical=v=>v&&typeof v==="object"?Array.isArray(v)?v.map(canonical):Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
       if(JSON.stringify(canonical(rows[0].request))!==JSON.stringify(canonical(p)))throw new Error("Synthetic Stripe idempotency conflict");
      }return rows[0].payload;}
     const id="cs_stage_"+randomUUID().replaceAll("-","");
     const s={id,livemode:false,url:"http://127.0.0.1:4101/session/"+id,mode:"payment",status:"open",payment_status:"unpaid",metadata:p.metadata,
      amount_total:p.line_items[0].price_data.unit_amount,currency:p.line_items[0].price_data.currency,expires_at:p.expires_at,stagingReturnBase:paymentContext.getStore()||"http://127.0.0.1:5174/order-confirmation"};
     await tx.$executeRawUnsafe('INSERT INTO staging_simulator.sessions(id,key,request,payload) VALUES($1,$2,$3::jsonb,$4::jsonb)',id,o.idempotencyKey,JSON.stringify(p),JSON.stringify(s));
     return s;
    });
    if(faults.stripeAfter){delete faults.stripeAfter;throw new Error("synthetic lost Stripe response");}return session;
   },
   retrieve:getSession,
   expire:async id=>{const s=await getSession(id);if(s.payment_status==="paid")throw new Error("already paid");s.status="expired";await db.$executeRawUnsafe('UPDATE staging_simulator.sessions SET payload=$2::jsonb WHERE id=$1',id,JSON.stringify(s));return s;}
  }};
  this.webhooks={constructEvent:(raw,sig,secret)=>signer.webhooks.constructEvent(raw,sig,secret)};
 }
}
require.cache[requireBackend.resolve("stripe")]={exports:LocalStripe};
const express=requireBackend("express"),{createApp}=require(path.join(root,"dist/app.js"));
const app=express(),sim=express();
function stagingOnly(req,res,next){
 const origin=req.get("Origin");res.set({"Cache-Control":"no-store","Referrer-Policy":"no-referrer"});
 if(origin&&!["http://127.0.0.1:4100","http://127.0.0.1:4101","http://127.0.0.1:5173","http://127.0.0.1:5174"].includes(origin))return res.status(403).json({error:"STAGING_ORIGIN_DENIED"});
 next();
}
app.use("/__staging",stagingOnly);sim.use(stagingOnly);
app.use((req,res,next)=>{
 res.set("Cache-Control","no-store");
 const operation=req.path==="/api/checkout/intent"?"intent":req.path==="/api/pay"?"pay":null;
 if(operation&&faults[operation+"Before"]){delete faults[operation+"Before"];req.socket.destroy();return;}
 if(operation&&faults[operation+"After"]){delete faults[operation+"After"];const original=res.json.bind(res);res.json=body=>{if(res.statusCode<400){req.socket.destroy();return res;}return original(body);};}
 next();
});
app.get("/__staging/image.svg",(_req,res)=>res.type("image/svg+xml").send('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#d4d4d8"/><text x="40" y="200">SYNTHETIC PRODUCT</text></svg>'));
app.get("/__staging/health",(_req,res)=>res.json({isolated:true,store:"http://127.0.0.1:5173",checkout:"http://127.0.0.1:5174",stripe:"local simulation",orderAccessRequired:process.env.STAGING_FINAL_FLOW==="true"}));
app.post("/__staging/faults",express.json(),(req,res)=>{for(const k of Object.keys(req.body||{})){if(!["intentBefore","intentAfter","payBefore","payAfter","stripeBefore","stripeAfter","simCompleteAfter"].includes(k))return res.status(400).json({error:"INVALID_SYNTHETIC_FAULT"});faults[k]=true;}res.json({ok:true});});
app.use((req,res,next)=>{
 if(req.method!=="POST"||req.path!=="/api/pay")return next();
 const destination=req.get("Origin")==="http://127.0.0.1:5173"?"http://127.0.0.1:5173/checkout/order-confirmation":"http://127.0.0.1:5174/order-confirmation";
 const original=res.json.bind(res);
 res.json=body=>{if(res.statusCode>=400||!body?.sessionId)return original(body);
  void getSession(body.sessionId).then(s=>{if(returnBase(s)!==destination){res.status(409);original({error:"STAGING_RETURN_CONFLICT"});}else original(body);}).catch(()=>{res.status(503);original({error:"STAGING_RETURN_RETRY"});});return res;};
 return paymentContext.run(destination,next);
});
app.use(createApp({logging:false,staging:process.env.STAGING_FINAL_FLOW==="true",orderAccessRequired:process.env.STAGING_FINAL_FLOW==="true",handoffOrigins:{store:"http://127.0.0.1:5173",checkout:"http://127.0.0.1:5174"}}));
sim.use(express.json());
async function emit(id,type="checkout.session.completed",eventId){
 const s=await getSession(id),event={id:eventId||"evt_stage_"+id+"_"+type.replaceAll(".","_"),type,livemode:false,data:{object:s}};
 const payload=JSON.stringify(event),sig=signer.webhooks.generateTestHeaderString({payload,secret:process.env.STRIPE_WEBHOOK_SECRET});
 const r=await fetch("http://127.0.0.1:4100/api/stripe/webhook",{method:"POST",headers:{"Content-Type":"application/json","Stripe-Signature":sig},body:payload});
 return {status:r.status,body:await r.json()};
}
// Synthetic-only proof, purpose-separated from webhook signing. No credential in a URL.
function proofSignature(payload){return createHmac("sha256",process.env.STRIPE_WEBHOOK_SECRET).update("local-payment-page:"+payload).digest();}
function pageProof(session){
 const payload=Buffer.from(JSON.stringify({sessionId:session.id,expiresAt:Date.now()+15*60000,nonce:randomBytes(24).toString("base64url")})).toString("base64url");
 return payload+"."+proofSignature(payload).toString("base64url");
}
function validPageProof(token,sessionId){
 try{
  if(typeof token!=="string"||token.length>1024||!/^([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]{43})$/.test(token))return false;
  const [payload,signature]=token.split("."),given=Buffer.from(signature,"base64url"),expected=proofSignature(payload);
  if(given.length!==expected.length||!timingSafeEqual(given,expected))return false;
  const value=JSON.parse(Buffer.from(payload,"base64url").toString("utf8"));
  return value.sessionId===sessionId&&Number.isSafeInteger(value.expiresAt)&&value.expiresAt>Date.now();
 }catch{return false;}
}
sim.get("/session/:id",async(req,res)=>{
 try{
  const s=await getSession(req.params.id),nonce=randomBytes(24).toString("base64url"),proof=pageProof(s);
  res.set({"Cache-Control":"no-store","Referrer-Policy":"no-referrer","Content-Security-Policy":"default-src 'none'; script-src 'nonce-"+nonce+"'; connect-src 'self'; form-action 'none'; base-uri 'none'"});
  const script=`const proof=${JSON.stringify(proof)},sessionId=${JSON.stringify(s.id)},returnBase=${JSON.stringify(returnBase(s))};
const button=document.getElementById("simulate"),status=document.getElementById("status");
button.addEventListener("click",async()=>{
 button.disabled=true;status.textContent="Paiement simule en cours...";
 try{
  const response=await fetch("/session/"+encodeURIComponent(sessionId)+"/complete",{method:"POST",mode:"cors",credentials:"omit",cache:"no-store",referrerPolicy:"no-referrer",headers:{"Content-Type":"application/json","X-Simulator-Token":proof},body:"{}",signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error("SIMULATOR_RETRY");
  const result=await response.json(),destination=new URL(result.redirect);
  if(destination.origin!==new URL(returnBase).origin||destination.pathname!==new URL(returnBase).pathname||destination.searchParams.get("session_id")!==sessionId||destination.username||destination.password||destination.hash)throw new Error("SIMULATOR_RETRY");
  window.location.assign(destination.href);
 }catch{status.textContent="Verification interrompue. Reessayez le meme paiement simule ou rechargez cette page.";button.disabled=false;}
});`;
  res.type("html").send('<h1>Paiement synthetique local</h1><p>EUR '+(s.amount_total/100).toFixed(2)+'</p><button id="simulate">Payer en simulation</button><p id="status" role="status"></p><script nonce="'+nonce+'">'+script+'</script>');
 }catch{res.sendStatus(404);}
});
sim.use("/session/:id/complete",(req,res,next)=>{
 if(req.get("Origin")!=="http://127.0.0.1:4101")return res.status(403).json({error:"STAGING_ORIGIN_DENIED"});
 if(req.method==="POST"&&(!req.is("application/json")||!validPageProof(req.get("X-Simulator-Token"),req.params.id)))
  return res.status(403).json({error:"SIMULATOR_SESSION_DENIED"});
 next();
});
sim.post("/session/:id/complete",async(req,res)=>{
 try{
 const s=await db.$transaction(async tx=>{
  const rows=await tx.$queryRawUnsafe('SELECT payload FROM staging_simulator.sessions WHERE id=$1 FOR UPDATE',req.params.id);
  if(!rows.length)throw Object.assign(new Error("Synthetic session unknown"),{code:"SIMULATOR_SESSION_UNKNOWN"});
  const session=rows[0].payload;
  if(session.payment_status!=="paid"){
   if(session.status==="expired"||session.expires_at*1000<=Date.now())throw Object.assign(new Error("Synthetic session expired"),{code:"SIMULATED_SESSION_EXPIRED"});
   session.status="complete";session.payment_status="paid";
   await tx.$executeRawUnsafe('UPDATE staging_simulator.sessions SET payload=$2::jsonb WHERE id=$1',session.id,JSON.stringify(session));
  }
  return session;
 });
 const result=await emit(s.id);const redirect=returnBase(s)+"?orderId="+encodeURIComponent(s.metadata.order_id)+"&session_id="+s.id;
 if(result.status>=400)return res.status(503).json({error:"SIMULATOR_RETRY"});
 if(faults.simCompleteAfter){delete faults.simCompleteAfter;req.socket.destroy();return;}
 res.json({webhook:result,redirect});
 }catch(error){res.status(error.code==="SIMULATED_SESSION_EXPIRED"?409:error.code==="SIMULATOR_SESSION_UNKNOWN"?404:503).json({error:error.code==="SIMULATED_SESSION_EXPIRED"||error.code==="SIMULATOR_SESSION_UNKNOWN"?error.code:"SIMULATOR_RETRY"});}
});
sim.post("/session/:id/event",async(req,res)=>{try{const type=req.body?.type;if(!["checkout.session.completed","checkout.session.expired","checkout.session.async_payment_succeeded"].includes(type))return res.sendStatus(400);res.json(await emit(req.params.id,type));}catch{res.sendStatus(503);}});
sim.get("/__staging/stats",async(_req,res)=>{const rows=await db.$queryRawUnsafe('SELECT COUNT(*)::int AS count FROM staging_simulator.sessions');res.json({sessions:rows[0].count,orders:await db.order.count(),finalizations:await db.paymentFinalization.count()});});
(async()=>{
 await db.$executeRawUnsafe("CREATE SCHEMA IF NOT EXISTS staging_simulator");
 await db.$executeRawUnsafe("CREATE TABLE IF NOT EXISTS staging_simulator.sessions(id text PRIMARY KEY,key text UNIQUE NOT NULL,request jsonb NOT NULL,payload jsonb NOT NULL)");
 // Seed only a brand new isolated staging DB; restart never overwrites user test attempts.
 if(await db.product.count()===0){
 const collection=await db.collection.create({data:{handle:"staging",title:"Staging Synthetic"}});
 for(let i=1;i<=40;i++)await db.product.create({data:{handle:"stage-"+String(i).padStart(3,"0"),title:"Synthetic Product "+i,vendor:"Synthetic",option1Name:"Size",option2Name:"Color",descriptionHtml:"<p>Only synthetic staging data.</p>",collections:{create:{collectionId:collection.id}},images:{create:{src:"http://127.0.0.1:4100/__staging/image.svg",position:1}},variants:{create:[{sku:"STAGE-"+i+"-M",option1:"M",option2:"Blue",price:"11.00",inventoryQuantity:i===40?1:5},{sku:"STAGE-"+i+"-L",option1:"L",option2:"Red",price:"99.90",inventoryQuantity:2}]}}});
 await db.discount.create({data:{code:"STAGE10",type:"PERCENTAGE",value:"10",usageLimit:2}});
 await db.discount.create({data:{code:"STAGE-LAST",type:"FIXED",value:"1",usageLimit:1}});
 await db.order.create({data:{id:"stage-legacy",customerName:"Synthetic Legacy",customerEmail:"legacy@example.invalid",total:"12.34"}});
 }
 const servers=[app.listen(4100,"127.0.0.1"),sim.listen(4101,"127.0.0.1")];
 const stop=()=>{servers.forEach(s=>s.closeAllConnections());servers.forEach(s=>s.close());void db.$disconnect().finally(()=>process.exit());};
 process.on("SIGTERM",stop);process.on("SIGINT",stop);
 console.log("Staging backend 4100, local Stripe simulator 4101, mandatory access disabled.");
})().catch(()=>{console.error("Staging bootstrap failed");process.exitCode=1;});
