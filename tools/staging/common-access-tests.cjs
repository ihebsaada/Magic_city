const {test,beforeEach}=require("node:test"),assert=require("node:assert/strict"),path=require("node:path"),{createRequire}=require("node:module"),vm=require("node:vm");
const root=path.resolve(__dirname,"../.."),store=path.join(root,"drip_frontend"),checkout=path.resolve(root,"../Magic_city_checkout_security/seamless_checkout_flow");
const req=createRequire(path.join(store,"package.json")),env={MODE:"staging",DEV:true,PROD:false,VITE_COMMON_CHECKOUT_ENABLED:"true",VITE_ROUTER_BASENAME:"/checkout/",VITE_LOCAL_STRIPE_ORIGIN:"http://127.0.0.1:4101",VITE_API_URL:"http://127.0.0.1:4100/api",VITE_PRIMARY_API_URL:"http://127.0.0.1:4100/api"};
let data,requests,publisher,client,fetcher;
const id="synthetic-common-a",token="T".repeat(43),key="K".repeat(24);
const attempt={version:1,checkoutMode:"common",state:"success",key,token,body:{items:[]},createdAt:new Date().toISOString(),calls:1,result:{orderId:id,redirectUrl:"http://127.0.0.1:5174/checkout-landing?orderId="+id}};
async function load(file,configuration=env,origin="http://127.0.0.1:5173"){
 const bundle=await req("esbuild").build({entryPoints:[file],bundle:true,write:false,platform:"node",format:"cjs",packages:"external",alias:{"@":path.join(path.dirname(file).includes("drip_frontend")?store:checkout,"src")},define:{"import.meta.env":JSON.stringify(configuration)}});
 const context={module:{exports:{}},require:req,crypto:require("node:crypto").webcrypto,URL,Headers,AbortController,DOMException,setTimeout,clearTimeout,window:{location:{origin}},sessionStorage:{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)},fetch:(...args)=>fetcher(...args)};
 vm.runInNewContext(bundle.outputFiles[0].text,context);return context.module.exports;
}
beforeEach(async()=>{
 data=new Map([["magic-city-drip-checkout-pending",JSON.stringify(attempt)]]);requests=[];
 fetcher=async(url,options)=>{requests.push({url:String(url),options});return Response.json({id,total:9.9,currency:"EUR",paymentStatus:"PENDING"});};
 publisher=await load(path.join(store,"src/lib/commonCheckout.ts"));
 client=await load(path.join(checkout,"src/lib/secureCheckout.ts"));
});
test("association precedes URL navigation and preserves frozen Store attempt",async()=>{
 const before=data.get("magic-city-drip-checkout-pending"),url=publisher.prepareCommonCheckout(id);
 assert.equal(url,"/checkout/checkout-landing?orderId="+id);assert.ok(!url.includes(token));
 assert.equal(data.get("magic-city-drip-checkout-pending"),before);
 assert.equal((await client.loadCommonOrder(id)).total,9.9);
 assert.equal(requests[0].options.headers["Order-Access-Token"],token);
 assert.equal(client.readAttempt(id).token,token);
});
test("duplicate publication and reload reuse identical association",async()=>{
 publisher.prepareCommonCheckout(id);const snapshot=new Map(data);
 publisher.prepareCommonCheckout(id);assert.deepEqual(data,snapshot);
 const reloaded=await load(path.join(checkout,"src/lib/secureCheckout.ts"));
 await reloaded.loadCommonOrder(id);assert.equal(reloaded.readAttempt(id).payCalls,0);
});
test("URL order identifier alone and another command never authorize",async()=>{
 await assert.rejects(client.loadCommonOrder(id));assert.equal(requests.length,0);
 publisher.prepareCommonCheckout(id);await assert.rejects(client.loadCommonOrder("synthetic-common-b"));assert.equal(requests.length,0);
});
test("different token or attempt key cannot replace an association",()=>{
 publisher.prepareCommonCheckout(id);const before=new Map(data);
 data.set("magic-city-drip-checkout-pending",JSON.stringify({...attempt,token:"X".repeat(43)}));
 assert.throws(()=>publisher.prepareCommonCheckout(id));assert.equal(data.get("magic-city-common-checkout-v1:"+id),before.get("magic-city-common-checkout-v1:"+id));
});
test("invalid or malformed association is blocked before network",async()=>{
 for(const raw of ["{",JSON.stringify({version:1,orderId:id,token:"invalid",attemptKey:key}),JSON.stringify({version:1,orderId:"another",token,attemptKey:key})]){
 data.set("magic-city-common-checkout-v1:"+id,raw);await assert.rejects(client.loadCommonOrder(id));
 }assert.equal(requests.length,0);
});
test("expired or revoked backend credentials remain blocked with unchanged storage",async()=>{
 publisher.prepareCommonCheckout(id);
 for(const code of ["ORDER_ACCESS_DENIED","ORDER_ACCESS_EXPIRED","ORDER_ACCESS_REVOKED"]){
 fetcher=async()=>Response.json({error:code},{status:401});const before=new Map(data);
 await assert.rejects(client.loadCommonOrder(id));assert.deepEqual(data,before);
 }assert.equal(client.readAttempt(id).authorized,undefined);
});
test("lost response and explicit retry retain same order token and request",async()=>{
 publisher.prepareCommonCheckout(id);const before=new Map(data),normal=fetcher;
 fetcher=async()=>{throw Error("offline");};await assert.rejects(client.loadCommonOrder(id));assert.deepEqual(data,before);
 fetcher=normal;await client.loadCommonOrder(id);assert.equal(requests[0].options.headers["Order-Access-Token"],token);
 assert.ok(!requests[0].url.includes(token));assert.equal(data.get("magic-city-drip-checkout-pending"),before.get("magic-city-drip-checkout-pending"));
});
test("existing different Checkout credential is never replaced",async()=>{
 publisher.prepareCommonCheckout(id);data.set("drip-checkout-guest-v1:"+id,JSON.stringify({orderId:id,token:"X".repeat(43),authorized:true,payCalls:2,prepareCalls:1,sessionId:"cs_test_existing"}));
 const before=new Map(data);await assert.rejects(client.loadCommonOrder(id));assert.deepEqual(data,before);assert.equal(requests.length,0);
});
test("existing same-token Stripe state and budgets survive adoption",async()=>{
 publisher.prepareCommonCheckout(id);data.set("drip-checkout-guest-v1:"+id,JSON.stringify({orderId:id,token,authorized:true,payCalls:2,prepareCalls:1,sessionId:"cs_test_existing"}));
 await client.loadCommonOrder(id);assert.equal(client.readAttempt(id).sessionId,"cs_test_existing");assert.equal(client.readAttempt(id).payCalls,2);
});
test("concurrent session change prevents adoption",async()=>{
 publisher.prepareCommonCheckout(id);
 fetcher=async()=>{data.set("drip-checkout-guest-v1:"+id,JSON.stringify({orderId:id,token,authorized:true,payCalls:1,prepareCalls:0,sessionId:"cs_test_concurrent"}));return Response.json({id,total:9.9,currency:"EUR"});};
 await assert.rejects(client.loadCommonOrder(id));assert.equal(client.readAttempt(id).sessionId,"cs_test_concurrent");
});
test("cancelled navigation and failed publication storage do not authorize",async()=>{
 publisher.prepareCommonCheckout(id);const controller=new AbortController();controller.abort();
 await assert.rejects(client.loadCommonOrder(id,controller.signal));assert.equal(client.readAttempt(id).authorized,undefined);
 data.delete("magic-city-common-checkout-v1:"+id);
 const original=data.get("magic-city-drip-checkout-pending");
 data.set=()=>{throw Error("Storage unavailable");};
 assert.throws(()=>publisher.prepareCommonCheckout(id));assert.equal(data.get("magic-city-drip-checkout-pending"),original);
});
test("wrong backend order and currency never authorize",async()=>{
 publisher.prepareCommonCheckout(id);
 for(const response of [{id:"wrong",total:9.9,currency:"EUR"},{id,total:9.9,currency:"USD"}]){
 fetcher=async()=>Response.json(response);await assert.rejects(client.loadCommonOrder(id));assert.equal(client.readAttempt(id).authorized,undefined);
 }
});
test("production, missing flag and legacy origin cannot activate automatic transfer",async()=>{
 for(const [configuration,origin] of [[{...env,DEV:false,PROD:true},"http://127.0.0.1:5173"],[{...env,VITE_COMMON_CHECKOUT_ENABLED:undefined},"http://127.0.0.1:5173"],[env,"http://127.0.0.1:5174"]]){
 const pub=await load(path.join(store,"src/lib/commonCheckout.ts"),configuration,origin);
 const access=await load(path.join(checkout,"src/lib/secureCheckout.ts"),configuration,origin);
 assert.equal(pub.prepareCommonCheckout(id),null);assert.equal(access.commonAccessEnabled(),false);await assert.rejects(access.loadCommonOrder(id));
 }assert.equal(requests.length,0);
});

test("common payment rechecks access, deduplicates and stores session before navigation",async()=>{
 publisher.prepareCommonCheckout(id);let calls=0;
 fetcher=async(url)=>{if(String(url).endsWith('/pay')){calls++;return Response.json({url:'http://127.0.0.1:4101/session/cs_stage_test',sessionId:'cs_stage_test'});}return Response.json({id,total:9.9,currency:'EUR',paymentStatus:'PENDING'});};
 const results=await Promise.all([client.pay(id),client.pay(id)]);assert.equal(calls,1);assert.equal(results[0].sessionId,results[1].sessionId);assert.equal(client.readAttempt(id).sessionId,'cs_stage_test');
 const reloaded=await load(path.join(checkout,'src/lib/secureCheckout.ts'));await reloaded.pay(id);assert.equal(calls,2);assert.equal(reloaded.readAttempt(id).sessionId,'cs_stage_test');
 await assert.rejects(reloaded.confirm(id,'cs_stage_wrong'));assert.equal(reloaded.readAttempt(id).sessionId,'cs_stage_test');
});
test("common payment blocks denied access and preserves credentials after lost response",async()=>{
 publisher.prepareCommonCheckout(id);let calls=0;
 fetcher=async(url)=>{if(String(url).endsWith('/pay')){calls++;throw Error('lost response');}return Response.json({id,total:9.9,currency:'EUR',paymentStatus:'PENDING'});};
 await assert.rejects(client.pay(id));assert.equal(calls,1);assert.equal(client.readAttempt(id).token,token);
 fetcher=async()=>Response.json({error:'ORDER_ACCESS_DENIED'},{status:401});await assert.rejects(client.pay(id));assert.equal(calls,1);assert.equal(client.readAttempt(id).token,token);
});

test("common simulator URL restrictions and incompatible sessions remain enforced",async()=>{
 assert.equal(client.validatePaymentURL('http://127.0.0.1:4101/session/cs_stage_test').origin,'http://127.0.0.1:4101');
 for(const url of ['http://127.0.0.1:4102/session/x','http://localhost:4101/session/x','http://user:pass@127.0.0.1:4101/session/x','https://checkout.stripe.com.evil.invalid/x','https://evil.checkout.stripe.com/x','http://127.0.0.1:4101/session/x#secret'])assert.throws(()=>client.validatePaymentURL(url));
 publisher.prepareCommonCheckout(id);await client.loadCommonOrder(id);
 data.set('drip-checkout-guest-v1:'+id,JSON.stringify({...client.readAttempt(id),sessionId:'cs_stage_existing'}));
 fetcher=async(url)=>Response.json(String(url).endsWith('/pay')?{url:'http://127.0.0.1:4101/session/cs_stage_new',sessionId:'cs_stage_new'}:{id,total:9.9,currency:'EUR',paymentStatus:'PENDING'});
 await assert.rejects(client.pay(id));assert.equal(client.readAttempt(id).sessionId,'cs_stage_existing');
});

test("common payment rejects mismatched URL session and concurrent credential replacement",async()=>{
 publisher.prepareCommonCheckout(id);await client.loadCommonOrder(id);
 fetcher=async(url)=>Response.json(String(url).endsWith('/pay')?{url:'http://127.0.0.1:4101/session/cs_stage_wrong',sessionId:'cs_stage_expected'}:{id,total:9.9,currency:'EUR',paymentStatus:'PENDING'});
 await assert.rejects(client.pay(id));assert.equal(client.readAttempt(id).sessionId,undefined);
 fetcher=async(url)=>{if(String(url).endsWith('/pay')){data.set('drip-checkout-guest-v1:'+id,JSON.stringify({...client.readAttempt(id),token:'X'.repeat(43)}));return Response.json({url:'http://127.0.0.1:4101/session/cs_stage_expected',sessionId:'cs_stage_expected'});}return Response.json({id,total:9.9,currency:'EUR',paymentStatus:'PENDING'});};
 await assert.rejects(client.pay(id));assert.equal(client.readAttempt(id).token,'X'.repeat(43));assert.equal(client.readAttempt(id).sessionId,undefined);
});

test("historical saved attempt is not transferred; existing common association stays recoverable",async()=>{
 data.set('magic-city-drip-checkout-pending',JSON.stringify({...attempt,checkoutMode:undefined}));const before=new Map(data);
 assert.equal(publisher.prepareCommonCheckout(id),null);assert.deepEqual(data,before);
 data.set('magic-city-drip-checkout-pending',JSON.stringify({...attempt,checkoutMode:'historical'}));assert.equal(publisher.prepareCommonCheckout(id),null);
 data.set('magic-city-drip-checkout-pending',JSON.stringify({...attempt,checkoutMode:undefined}));
 data.set('magic-city-common-checkout-v1:'+id,JSON.stringify({version:1,orderId:id,token,attemptKey:key}));
 const saved=data.get('magic-city-drip-checkout-pending');assert.equal(publisher.prepareCommonCheckout(id),'/checkout/checkout-landing?orderId='+id);assert.equal(data.get('magic-city-drip-checkout-pending'),saved);
 await client.loadCommonOrder(id);assert.equal(client.readAttempt(id).token,token);
});
test("new local attempt persists its route once without putting it in the API body",async()=>{
 data.clear();const a=await load(path.join(store,'src/lib/checkoutAttempt.ts'));
 const created=a.newCheckoutAttempt({items:[]});assert.equal(created.checkoutMode,'common');assert.equal(created.body.checkoutMode,undefined);
});

test("common Checkout no longer displays a disabled-preview warning beside an enabled payment",()=>{
 const source=require('node:fs').readFileSync(path.join(checkout,'src/pages/CheckoutLanding.tsx'),'utf8');assert.ok(!source.includes('Pagamento non disponibile in questa anteprima locale'));assert.ok(source.includes('disabled={busy || order.paymentStatus !== "PENDING"}'));
});
