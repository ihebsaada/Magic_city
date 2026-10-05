import path from 'node:path';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
const workspace=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const output=path.join(workspace,'tools/staging/.runtime/public-build-'+Date.now());
fs.mkdirSync(output,{recursive:true});
for(const key of Object.keys(process.env))if(!['PATH','Path','SystemRoot','TEMP','TMP'].includes(key))delete process.env[key];
process.env.NODE_ENV='production';
Object.assign(process.env,{VITE_API_URL:'https://magiccitystagingbackend.onrender.com/api',VITE_PRIMARY_API_URL:'https://magiccitystagingbackend.onrender.com/api',VITE_STORE_ORIGIN:'https://magiccity-store-staging.netlify.app',VITE_CHECKOUT_ORIGIN:'https://magiccity-checkout-staging.netlify.app',VITE_ROUTER_BASENAME:'/',VITE_AUTOMATIC_HANDOFF:'false',VITE_NAVIGATION_HANDOFF_ENABLED:'true'});
for(const [name,root] of [['store',path.join(workspace,'drip_frontend')],['checkout',path.resolve(workspace,'../Magic_city_checkout_security/seamless_checkout_flow')]]){
 process.chdir(root);
 const require=createRequire(path.join(root,'package.json'));
 const {build}=await import(pathToFileURL(path.join(path.dirname(require.resolve('vite/package.json')),'dist/node/index.js')));
 const outDir=path.join(output,name);
 await build({root,mode:'staging',envDir:output,build:{outDir,emptyOutDir:false}});
 const files=fs.readdirSync(path.join(outDir,'assets')).filter(f=>f.endsWith('.js'));
 const code=files.map(f=>fs.readFileSync(path.join(outDir,'assets',f),'utf8')).join('\n');
 assert.ok(code.includes(process.env.VITE_API_URL));
 assert.ok(!code.includes('http://localhost:4000/api'));
 assert.ok(!code.includes('/api/seamless/checkout'));
 for(const forbidden of ['https://magic-city-n6rr.onrender.com','https://dripcheckout.netlify.app','sk_live_','-----BEGIN PRIVATE KEY-----'])assert.ok(!code.includes(forbidden));
 console.log('PASS '+name+' isolated staging bundle uses staging API, no localhost API or seamless endpoint');
}
console.log('Local builds only; no deployment, network requests or browser validation.');
