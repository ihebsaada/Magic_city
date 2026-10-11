import path from 'node:path';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const checkout=path.resolve(root,'../Magic_city_checkout_security/seamless_checkout_flow');
const require=createRequire(path.join(checkout,'package.json'));
const {build}=await import(pathToFileURL(path.join(path.dirname(require.resolve('vite/package.json')),'dist/node/index.js')));
const directory=path.join(root,'tools/staging/.runtime/payment-policy-'+Date.now());
fs.mkdirSync(directory,{recursive:true});
// Deliberately configure the simulator: neither production build may accept it.
process.env.NODE_ENV='production';
process.env.VITE_LOCAL_STRIPE_ORIGIN='http://127.0.0.1:4101';
Object.defineProperty(globalThis,'window',{value:{location:{origin:'http://127.0.0.1:5174'}},configurable:true});
const results=[];
for(const mode of ['production','staging']){
 const out=path.join(directory,mode);
 await build({root:checkout,mode,envDir:directory,build:{outDir:out,emptyOutDir:false,minify:false,lib:{entry:path.join(checkout,'tests/payment-url-entry.ts'),formats:['es'],fileName:()=>'payment-policy.mjs'}}});
 const {validatePaymentURL}=await import(pathToFileURL(path.join(out,'payment-policy.mjs')));
 assert.equal(validatePaymentURL('https://checkout.stripe.com/c/pay/test').origin,'https://checkout.stripe.com');
 for(const url of ['http://127.0.0.1:4101/session/cs_stage_test','http://checkout.stripe.com/pay','https://checkout.stripe.com:444/pay','https://sub.checkout.stripe.com/pay','https://user:password@checkout.stripe.com/pay'])assert.throws(()=>validatePaymentURL(url));
 results.push({mode,productionBuild:true,configuredSimulatorRejected:true,status:'PASS'});
}
const storeRequire=createRequire(path.join(root,'drip_frontend/package.json'));
const {ESLint}=storeRequire('eslint'),js=storeRequire('@eslint/js'),globals=storeRequire('globals');
const files=['src/lib/secureCheckout.ts','tests/payment-url.test.ts','tests/payment-url-entry.ts','scripts/run-tests.mjs'];
const linter=new ESLint({cwd:checkout,overrideConfig:[{files:['**/*.mjs'],languageOptions:{globals:globals.node}}]});
const rows=await linter.lintFiles(files);
const toolsLinter=new ESLint({cwd:root,overrideConfigFile:true,overrideConfig:[js.configs.recommended,{languageOptions:{globals:globals.node}}]});
const toolRows=await toolsLinter.lintFiles(['tools/staging/start.cjs','tools/staging/payment-url-validation.mjs','tools/staging/scenario.cjs']);
const errors=[...rows,...toolRows].reduce((n,r)=>n+r.errorCount,0);
fs.writeFileSync(path.join(directory,'lint.log'),(await linter.loadFormatter('stylish')).format([...rows,...toolRows]));
assert.equal(errors,0,'Lint errors: inspect local lint.log');
results.push({lintErrors:errors,status:'PASS'});
fs.writeFileSync(path.join(root,'tools/staging/PAYMENT_URL_RESULTS.json'),JSON.stringify({date:new Date().toISOString(),results,browserExecuted:false},null,2));
console.log('PASS: two actual Vite production builds reject configured simulator; changed-file lint passes.');
