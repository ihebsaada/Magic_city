import path from 'node:path';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const store=path.join(root,'drip_frontend'),checkout=path.resolve(root,'../Magic_city_checkout_security/seamless_checkout_flow');
const req=createRequire(path.join(store,'package.json'));
const {build}=await import(pathToFileURL(path.join(path.dirname(req.resolve('vite/package.json')),'dist/node/index.js')));
const directory=path.join(root,'tools/staging/.runtime/common-production-'+Date.now());
fs.mkdirSync(directory,{recursive:true});
process.env.VITE_LOCAL_STRIPE_ORIGIN='http://127.0.0.1:4101';process.env.NODE_ENV='production';process.env.VITE_COMMON_CHECKOUT_ENABLED='true';process.env.VITE_ROUTER_BASENAME='/checkout/';
Object.defineProperty(globalThis,'window',{value:{location:{origin:'http://127.0.0.1:5173'}},configurable:true});
globalThis.sessionStorage={getItem(){throw new Error('Unexpected storage read');},setItem(){throw new Error('Unexpected storage write');}};
const results=[];
for(const mode of ['production','staging']){
 for(const [name,project,entry] of [['store',store,'src/lib/commonCheckout.ts'],['checkout',checkout,'src/lib/secureCheckout.ts']]){
  const out=path.join(directory,mode,name);
  await build({root:project,mode,envDir:directory,build:{outDir:out,emptyOutDir:false,minify:false,lib:{entry:path.join(project,entry),formats:['es'],fileName:()=>'policy.mjs'}}});
  const module=await import(pathToFileURL(path.join(out,'policy.mjs')));
  if(name==='store'){assert.equal(module.commonCheckoutEnabled(),false);assert.equal(module.prepareCommonCheckout('synthetic-order'),null);}
  else{assert.equal(module.commonAccessEnabled(),false);await assert.rejects(module.loadCommonOrder('synthetic-order'));assert.throws(()=>module.validatePaymentURL('http://127.0.0.1:4101/session/cs_stage_test'));assert.equal(module.validatePaymentURL('https://checkout.stripe.com/c/pay/test').origin,'https://checkout.stripe.com');}
  results.push({mode,name,status:'PASS',configuredAutomaticAccessDisabled:true});
 }
}
fs.writeFileSync(path.join(root,'tools/staging/COMMON_ACCESS_PRODUCTION_RESULTS.json'),JSON.stringify({date:new Date().toISOString(),results},null,2));
console.log('PASS automatic transfer disabled in four actual production bundles despite explicit flag.');
