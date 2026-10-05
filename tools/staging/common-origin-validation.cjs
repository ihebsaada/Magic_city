const fs=require("node:fs"),path=require("node:path"),{spawnSync}=require("node:child_process"),{createRequire}=require("node:module");
const root=path.resolve(__dirname,"../.."),store=path.join(root,"drip_frontend"),checkout=path.resolve(root,"../Magic_city_checkout_security/seamless_checkout_flow");
const directory=path.join(__dirname,".runtime","common-build-"+Date.now());fs.mkdirSync(directory,{recursive:true});
const env={};for(const k of ["PATH","Path","SystemRoot","TEMP","TMP"])if(process.env[k])env[k]=process.env[k];
Object.assign(env,{NODE_ENV:"production",VITE_API_URL:"http://127.0.0.1:4100/api",VITE_PRIMARY_API_URL:"http://127.0.0.1:4100/api",VITE_STORE_ORIGIN:"http://127.0.0.1:5173",VITE_CHECKOUT_ORIGIN:"http://127.0.0.1:5174"});
const results=[];
function run(name,cwd,args,vars={}){
 const r=spawnSync(process.execPath,args,{cwd,env:{...env,...vars},encoding:"utf8",timeout:120000});
 fs.writeFileSync(path.join(directory,name+".log"),(r.stdout||"")+(r.stderr||""));
 if(r.status!==0)throw Error(name+" failed");
 results.push({name,status:"PASS"});console.log("PASS "+name);
}
(async()=>{
 for(const [name,dir,port,base] of [["store",store,"5173",undefined],["checkout-prefix",checkout,"5174","/checkout/"]]){
 run(name+"-build",dir,[path.join(__dirname,"frontend.mjs")],{STAGING_FRONTEND_ROOT:dir,STAGING_FRONTEND_PORT:port,STAGING_ENV_DIR:directory,STAGING_BUILD_DIR:path.join(directory,name),...(base?{STAGING_CHECKOUT_BASE:base}:{})});
 const html=fs.readFileSync(path.join(directory,name,"index.html"),"utf8");
 if(base&&!html.includes('/checkout/assets/'))throw Error("Prefixed build assets missing");
 }
 run("store-tests",store,["scripts/run-tests.mjs"],{NODE_ENV:"test"});
 const req=createRequire(path.join(store,"package.json")),{ESLint}=req("eslint"),js=req("@eslint/js"),globals=req("globals");
 const lint=new ESLint({cwd:root,overrideConfigFile:true,overrideConfig:[js.configs.recommended,{languageOptions:{globals:globals.node}}]});
 const rows=await lint.lintFiles(["tools/staging/frontend.mjs","tools/staging/start.cjs","tools/staging/common-origin-tests.cjs","tools/staging/common-origin-validation.cjs","tools/staging/common-access-tests.cjs","tools/staging/common-access-production.mjs","tools/staging/scenario.cjs","tools/staging/validate.cjs","tools/staging/compatibility-inventory.cjs"]);
 const appLint=new ESLint({cwd:checkout}),appRows=await appLint.lintFiles(["src/App.tsx","src/lib/secureCheckout.ts","src/pages/CheckoutLanding.tsx"]);
 const storeLint=new ESLint({cwd:store}),storeRows=await storeLint.lintFiles(["src/pages/Cart.tsx","src/lib/commonCheckout.ts"]);
 rows.push(...storeRows);
 const errors=[...rows,...appRows].reduce((n,r)=>n+r.errorCount,0);
 fs.writeFileSync(path.join(directory,"lint.log"),(await lint.loadFormatter("stylish")).format([...rows,...appRows]));
 if(errors)throw Error("Changed-file lint failed");
 results.push({name:"changed-file-lint",status:"PASS"});console.log("PASS changed-file-lint");
})().catch(e=>{console.error(e.message);results.push({name:"failure",status:"FAIL"});process.exitCode=1;}).finally(()=>fs.writeFileSync(path.join(__dirname,"COMMON_BUILD_RESULTS.json"),JSON.stringify({date:new Date().toISOString(),results,browserExecuted:false},null,2)));
