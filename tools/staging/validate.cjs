const fs=require("node:fs"),path=require("node:path"),{spawnSync}=require("node:child_process"),{createRequire}=require("node:module");
const root=path.resolve(__dirname,"../.."),parent=path.dirname(root),backend=path.join(parent,"Magic_city_backend_security/drip_backend"),store=path.join(root,"drip_frontend"),checkout=path.join(parent,"Magic_city_checkout_security/seamless_checkout_flow");
const directory=path.join(__dirname,".runtime","validation-"+Date.now());fs.mkdirSync(directory,{recursive:true});
const env={};for(const k of ["PATH","Path","SystemRoot","TEMP","TMP"])if(process.env[k])env[k]=process.env[k];
Object.assign(env,{NODE_ENV:"test",DATABASE_URL:"postgresql://synthetic@127.0.0.1:5432/synthetic",JWT_SECRET:"synthetic-only-signing-key",STRIPE_SECRET_KEY:"sk_test_synthetic_not_a_real_key",STRIPE_WEBHOOK_SECRET:"synthetic",VITE_API_URL:"http://127.0.0.1:4100/api",VITE_PRIMARY_API_URL:"http://127.0.0.1:4100/api",VITE_CHECKOUT_ORIGIN:"http://127.0.0.1:5174",VITE_STORE_ORIGIN:"http://127.0.0.1:5173"});
const results=[];
function run(label,cwd,args,extra={}){
 const r=spawnSync(process.execPath,args,{cwd,env:{...env,...extra},encoding:"utf8",timeout:240000,maxBuffer:10*1024*1024});
 fs.writeFileSync(path.join(directory,label+".log"),(r.stdout||"")+(r.stderr||""));
 const counts=[...(r.stdout||"").matchAll(/tests ([0-9]+)/g)].map(m=>Number(m[1]));
 results.push({name:label,status:r.status===0?"PASS":"FAIL",testCount:counts.reduce((a,b)=>a+b,0),exitCode:r.status});
 console.log(label+": "+(r.status===0?"PASS":"FAIL")+(counts.length?" ("+counts.reduce((a,b)=>a+b,0)+" tests)":""));
}
(async()=>{
 run("backend-prisma-generate",backend,[path.join(backend,"node_modules/prisma/build/index.js"),"generate"]);
 run("backend-prisma-validate",backend,[path.join(backend,"node_modules/prisma/build/index.js"),"validate"]);
 for(const [name,dir] of [["backend",backend],["store",store],["checkout",checkout]]){
 const tsc=path.join(dir,"node_modules/typescript/bin/tsc");
 for(const project of name==="backend"?["tsconfig.json"]:["tsconfig.app.json","tsconfig.node.json","tsconfig.tests.json"])run(name+"-"+project,dir,[tsc,"--noEmit","-p",project]);
 if(name==="backend")run("backend-build",dir,[tsc]);else run(name+"-build",dir,[path.join(__dirname,"frontend.mjs")],{NODE_ENV:"production",STAGING_FRONTEND_ROOT:dir,STAGING_FRONTEND_PORT:name==="store"?"5173":"5174",STAGING_ENV_DIR:directory,STAGING_BUILD_DIR:path.join(directory,"build-"+name)});
 run(name+"-tests",dir,[name==="backend"?"tests/run-tests.cjs":"scripts/run-tests.mjs"]);
 }
 const artifact=path.join(backend,"tests/catalog-performance.json"),original=fs.readFileSync(artifact);
 run("common-access-tests",root,[path.join(__dirname,"common-access-tests.cjs")]);
 try{run("backend-postgres-all",backend,["tests/run-postgres-tests.cjs"]);fs.copyFileSync(artifact,path.join(directory,"catalog-performance-staging.json"));}
 finally{fs.writeFileSync(artifact,original);}
 const req=createRequire(path.join(store,"package.json")),{ESLint}=req("eslint"),ts=req("typescript-eslint"),js=req("@eslint/js"),globals=req("globals");
 for(const [name,dir,files] of [
 ["staging-tooling",root,["tools/staging/start.cjs","tools/staging/backend.cjs","tools/staging/scenario.cjs","tools/staging/resume-smoke.cjs","tools/staging/validate.cjs","tools/staging/frontend.mjs","tools/staging/compatibility-inventory.cjs","tools/staging/automatic-handoff-http.cjs","tools/staging/public-bundle-validation.mjs","tools/staging/final-flow-scenario.cjs"]],
 ["backend-handoff",backend,["src/controllers/orderController.ts","src/services/navigationHandoff.ts","src/routes/navigationHandoffRoutes.ts","src/services/shipping.ts","src/services/orderCreation.ts","src/services/orderIdempotency.ts","tests/navigation.integration.test.cjs","src/app.ts","src/services/orderHandoff.ts","src/services/guestOrderAccess.ts","src/routes/orderHandoffRoutes.ts","tests/handoff.integration.test.cjs","tests/run-postgres-tests.cjs"]],
 ["store-handoff",store,["tests/navigation-handoff.test.ts","src/lib/navigationHandoff.ts","src/lib/paidCart.ts","src/contexts/CartContext.tsx","src/hooks/useHistoricalLoading.ts","src/components/layout/Layout.tsx","src/lib/automaticHandoff.ts","tests/automatic-handoff.test.ts","tests/historical-loading.test.tsx","src/components/CatalogueBrowser.tsx","src/components/CollectionCard.tsx","src/pages/CollectionDetail.tsx","src/components/CheckoutHandoff.tsx","src/lib/handoffLink.ts","src/lib/commonCheckout.ts","src/lib/checkoutAttempt.ts","src/lib/paidOrderCheck.ts","src/pages/Cart.tsx","tests/store-handoff.test.tsx","tests/checkout-validation.test.tsx","tests/store-backend-integration.test.tsx","scripts/run-tests.mjs"]],
 ["checkout-handoff",checkout,["tests/navigation-handoff.test.ts","src/lib/automaticHandoff.ts","src/lib/cart.ts","src/components/Navigation.tsx","src/pages/Home.tsx","src/pages/Cart.tsx","tests/automatic-handoff.test.ts","tests/mirror-parity.test.tsx","tests/store-navigation.test.ts","src/lib/secureCheckout.ts","src/pages/CheckoutLanding.tsx","src/pages/OrderConfirmation.tsx","tests/secure-checkout.test.ts","scripts/run-tests.mjs"]]]){
 const nodeOnly=name.startsWith("backend")||name==="staging-tooling";
 const overrides=[{files:["**/*.cjs","**/*.mjs"],languageOptions:{globals:globals.node},rules:{"@typescript-eslint/no-require-imports":"off","@typescript-eslint/no-unused-vars":"off"}}];
 const linter=nodeOnly?new ESLint({cwd:dir,overrideConfigFile:true,overrideConfig:[js.configs.recommended,...ts.configs.recommended,{languageOptions:{globals:globals.node},rules:{"@typescript-eslint/no-unused-vars":"off"}},...overrides,{files:["src/controllers/orderController.ts"],rules:{"@typescript-eslint/no-explicit-any":"off"}},{files:["src/services/orderCreation.ts"],rules:{"no-control-regex":"off"}}]}):new ESLint({cwd:dir,overrideConfig:overrides});
 const rows=await linter.lintFiles(files),errors=rows.reduce((n,r)=>n+r.errorCount,0);
 fs.writeFileSync(path.join(directory,name+"-lint.log"),(await linter.loadFormatter("stylish")).format(rows));
 results.push({name:name+"-lint",status:errors?"FAIL":"PASS",errors});console.log(name+" lint: "+(errors?"FAIL":"PASS"));
 }
 fs.writeFileSync(path.join(__dirname,"VALIDATION_RESULTS.json"),JSON.stringify({date:new Date().toISOString(),results,logs:path.relative(root,directory),browserExecuted:false},null,2));
 process.exitCode=results.some(r=>r.status==="FAIL")?1:0;
})().catch(e=>{console.error("Validation harness failed: "+e.message);process.exitCode=1;});
