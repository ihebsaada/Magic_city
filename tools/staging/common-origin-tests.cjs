const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const origin="http://127.0.0.1:5173",legacy="http://127.0.0.1:5174",results=[];
async function check(name,run){await run();results.push({name,status:"PASS"});console.log("PASS "+name);}
async function text(url){const r=await fetch(url);assert.equal(r.status,200,url);return {body:await r.text(),headers:r.headers};}
(async()=>{
 await check("Store and prefixed Checkout serve distinct module entrypoints",async()=>{
 const store=await text(origin+"/catalog"),checkout=await text(origin+"/checkout/checkout-landing");
 assert.ok(!store.headers.get('content-security-policy').includes('images.unsplash.com'));
 for(const page of [checkout,await text(legacy+'/')]){const csp=page.headers.get('content-security-policy');assert.ok(csp.includes("img-src 'self' http://127.0.0.1:4100 data: https://images.unsplash.com;"));assert.ok(!csp.includes('img-src *'));}
 assert.match(store.body,/src="\/src\/main.tsx"/);assert.match(checkout.body,/src="\/checkout\/src\/main.tsx"/);
 assert.equal(checkout.headers.get("referrer-policy"),"no-referrer");assert.match(checkout.headers.get("content-security-policy"),/default-src 'self'/);
 });
 await check("direct Checkout routes and reload return Checkout HTML; legacy stays available",async()=>{
 for(const route of ["/","/checkout-landing","/order-confirmation","/cart","/unknown-page"]){
 const a=await text(origin+"/checkout"+route);assert.match(a.body,/\/checkout\/src\/main.tsx/);
 const b=await text(legacy+route);assert.match(b.body,/src="\/src\/main.tsx"/);
 }
 const redirect=await fetch(origin+"/checkout",{redirect:"manual"});assert.equal(redirect.status,308);assert.equal(redirect.headers.get("location"),"/checkout/");
 });
 await check("Checkout basename is namespaced; legacy defaults and internal Link routes remain",async()=>{
 const common=await text(origin+"/checkout/src/App.tsx"),old=await text(legacy+"/src/App.tsx");
 assert.ok(common.body.includes('"VITE_ROUTER_BASENAME": "/checkout/"'));
 assert.ok(common.body.includes("basename: import.meta.env.VITE_ROUTER_BASENAME"));
 assert.ok(old.body.includes('?? "/"'));assert.ok(!old.body.includes('basename: "/checkout/"'));
 const navigation=await text(origin+"/checkout/src/components/Navigation.tsx");assert.match(navigation.body,/to:\s*["']\/cart["']/);
 });
 await check("both Vite module graphs, client and CSS resolve without crossing namespaces",async()=>{
 for(const prefix of ["","/checkout"]){
 for(const route of ["/src/main.tsx","/src/App.tsx","/src/index.css","/@vite/client"]){
 const r=await text(origin+prefix+route);assert.ok(!r.body.includes('<div id="root">'));
 }
 const main=await text(origin+prefix+"/src/main.tsx");
 const imports=[...main.body.matchAll(/from\s*["']([^"']+)["']/g)].map(m=>m[1]).filter(p=>p.startsWith("/"));
 assert.ok(imports.length>0);
 for(const target of imports){if(prefix)assert.ok(target.startsWith("/checkout/"),target);await text(origin+target);}
 }
 const commonAsset=await fetch(origin+"/checkout/bag.png"),legacyAsset=await fetch(legacy+"/bag.png");
 assert.equal(commonAsset.status,200);assert.equal(legacyAsset.status,200);
 assert.deepEqual(Buffer.from(await commonAsset.arrayBuffer()),Buffer.from(await legacyAsset.arrayBuffer()));
 assert.equal((await fetch(origin+"/logoMagicCity.png")).status,200);
 });
 await check("missing assets return 404; private runtime remains inaccessible",async()=>{
 for(const prefix of ["","/checkout"]){
 const missing=await fetch(origin+prefix+"/assets/phase-b-missing.js");assert.equal(missing.status,404,"Missing asset status for "+prefix);
 const privatePath="/@fs/"+process.env.STAGING_RUNTIME.replaceAll("\\","/")+"/scenario-private.json";
 const denied=await fetch(origin+prefix+privatePath);assert.ok([403,404].includes(denied.status),"Private file status "+denied.status+" for "+prefix);
 }
 });
 await check("API, payment and handoff configuration remain historical",async()=>{
 const source=await text(origin+"/checkout/src/lib/secureCheckout.ts");
 assert.ok(source.body.includes("http://127.0.0.1:4100/api"));
 assert.ok(source.body.includes('http://127.0.0.1:5174'));
 assert.ok(source.body.includes('http://127.0.0.1:4101')); // Common preview does not enable payment.
 assert.ok(source.body.includes('"VITE_COMMON_CHECKOUT_ENABLED": "true"'));
 });
})().catch(e=>{console.error("Common-origin test failed: "+String(e.message).split("\n")[0]);results.push({name:"failure",status:"FAIL"});process.exitCode=1;}).finally(()=>{
 fs.writeFileSync(path.join(__dirname,"COMMON_ORIGIN_RESULTS.json"),JSON.stringify({date:new Date().toISOString(),results,browserExecuted:false},null,2));
});
