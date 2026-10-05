const fs=require("node:fs"),path=require("node:path"),net=require("node:net");
const {spawn,spawnSync}=require("node:child_process");
const root=path.resolve(__dirname,"../.."),parent=path.dirname(root);
const backend=path.join(parent,"Magic_city_backend_security/drip_backend"),store=path.join(root,"drip_frontend"),checkout=path.join(parent,"Magic_city_checkout_security/seamless_checkout_flow");
const finalFlow=process.argv.includes("--final-flow");
const automatic=process.argv.includes("--automatic-handoff");
const resume=process.argv.find(a=>a.startsWith("--resume="))?.slice(9);
if(resume&&!/^run-[0-9]+$/.test(resume))throw new Error("Invalid isolated resume name");
const pg="C:/Program Files/PostgreSQL/17/bin",runtime=path.join(__dirname,".runtime",resume||"run-"+Date.now());
const env={};for(const k of ["PATH","Path","SystemRoot","TEMP","TMP"])if(process.env[k])env[k]=process.env[k];
Object.assign(env,{NAVIGATION_HANDOFF_SECRET:"synthetic-navigation-key-for-isolated-local-test",STAGING_FINAL_FLOW:finalFlow?"true":"false",NODE_ENV:"test",JWT_SECRET:"synthetic-staging-jwt",STRIPE_SECRET_KEY:"sk_test_synthetic_not_a_real_key",STRIPE_WEBHOOK_SECRET:"synthetic-staging-webhook",
 CHECKOUT_APP_URL:"http://127.0.0.1:5174",STRIPE_SUCCESS_URL:"http://127.0.0.1:5174/order-confirmation?orderId={ORDER_ID}&session_id={CHECKOUT_SESSION_ID}",STRIPE_CANCEL_URL:"http://127.0.0.1:5174/checkout-landing?orderId={ORDER_ID}"});
const children=[];let started=false,stopping=false;
function run(exe,args){const r=spawnSync(exe,args,{cwd:backend,env,encoding:"utf8",stdio:exe.endsWith("pg_ctl.exe")?"ignore":"pipe",timeout:60000});if(r.status!==0)throw new Error("Staging command failed: "+path.basename(exe)+" "+(r.stderr||r.stdout||r.error?.message||""));return r;}
function stop(){if(stopping)return;stopping=true;for(const c of children)c.kill();if(started)run(path.join(pg,"pg_ctl.exe"),["-D",path.join(runtime,"pg"),"-w","stop","-m","fast"]);console.log("Staging stopped. Synthetic cluster retained: "+runtime);}
process.on("SIGINT",()=>{stop();process.exit();});process.on("SIGTERM",()=>{stop();process.exit();});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 for(const p of [4100,4101,5173,5174])await new Promise((resolve,reject)=>{const s=net.createServer();s.once("error",()=>reject(new Error("Port occupied: "+p)));s.listen(p,"127.0.0.1",()=>s.close(resolve));});
 fs.mkdirSync(runtime,{recursive:true});
 const port=resume?Number(new URL(JSON.parse(fs.readFileSync(path.join(runtime,"staging-environment.json"),"utf8")).database).port):await new Promise(resolve=>{const s=net.createServer();s.listen(0,"127.0.0.1",()=>{const p=s.address().port;s.close(()=>resolve(p));});});
 if(resume){const status=spawnSync(path.join(pg,"pg_ctl.exe"),["-D",path.join(runtime,"pg"),"status"],{env,stdio:"ignore"});if(status.status===0)throw new Error("Resume cluster already running; leave it untouched");}
 if(!resume)run(path.join(pg,"initdb.exe"),["-D",path.join(runtime,"pg"),"-U","magic_staging","-A","trust","--encoding=UTF8","--no-locale"]);
 run(path.join(pg,"pg_ctl.exe"),["-D",path.join(runtime,"pg"),"-l",path.join(runtime,"postgres.log"),"-o","-h 127.0.0.1 -p "+port,"-w","start"]);started=true;
 if(!resume)run(path.join(pg,"createdb.exe"),["-h","127.0.0.1","-p",String(port),"-U","magic_staging","magic_staging"]);
 env.DATABASE_URL="postgresql://magic_staging@127.0.0.1:"+port+"/magic_staging";
 const cli=path.join(backend,"node_modules/prisma/build/index.js");
 run(process.execPath,[cli,"migrate","deploy"]);
 fs.writeFileSync(path.join(runtime,"staging-environment.json"),JSON.stringify({database:env.DATABASE_URL,backend:"http://127.0.0.1:4100",store:"http://127.0.0.1:5173",checkout:"http://127.0.0.1:5174",simulator:"http://127.0.0.1:4101",syntheticOnly:true},null,2));
 const launch=(file,vars,cwd)=>{const c=spawn(process.execPath,[path.join(__dirname,file)],{cwd,env:{...env,...vars},stdio:["ignore","pipe","pipe"]});children.push(c);const log=fs.createWriteStream(path.join(runtime,file+"."+(vars.STAGING_FRONTEND_PORT||"backend")+".log"));c.stdout.pipe(log);c.stderr.pipe(log);c.on("exit",code=>{if(!stopping){console.error("Staging child exited: "+file+" "+code);stop();process.exitCode=1;}});return c;};
 launch("backend.cjs",{STAGING_BACKEND_ROOT:backend},backend);
 const environment={VITE_NAVIGATION_HANDOFF_ENABLED:finalFlow?"true":"false",VITE_AUTOMATIC_HANDOFF:automatic?"true":"false",VITE_API_URL:"http://127.0.0.1:4100/api",VITE_PRIMARY_API_URL:"http://127.0.0.1:4100/api",VITE_CHECKOUT_ORIGIN:"http://127.0.0.1:5174",VITE_STORE_ORIGIN:"http://127.0.0.1:5173"};
  for(const [directory,port] of [[store,5173],[checkout,5174]])launch("frontend.mjs",{...environment,...(port===5174?{VITE_LOCAL_STRIPE_ORIGIN:"http://127.0.0.1:4101"}:{STAGING_COMMON_CHECKOUT_ROOT:checkout,VITE_COMMON_CHECKOUT_ENABLED:(automatic||finalFlow)?"false":"true"}),NODE_ENV:"development",STAGING_FRONTEND_ROOT:directory,STAGING_FRONTEND_PORT:String(port),STAGING_ENV_DIR:runtime},directory);
 for(const url of ["http://127.0.0.1:4100/__staging/health","http://127.0.0.1:5173","http://127.0.0.1:5174"]){
  let ready=false;for(let i=0;i<100&&!stopping;i++){try{ready=(await fetch(url)).ok;if(ready)break;}catch{/* Servers may still be starting; retry locally. */}await pause(200);}
  if(!ready)throw new Error("Staging startup failed; inspect local runtime logs.");
 }
 console.log("READY: Store http://127.0.0.1:5173/catalog | Checkout http://127.0.0.1:5174/checkout-landing | API http://127.0.0.1:4100/api");
  console.log("Synthetic fixtures: STAGE10, sizes M/Blue and L/Red. Local development Checkout explicitly permits simulator http://127.0.0.1:4101.");
 if(process.argv.includes("--verify")){
  const r=spawnSync(process.execPath,[path.join(__dirname,finalFlow?"final-flow-scenario.cjs":resume?"resume-smoke.cjs":"scenario.cjs")],{env:{...env,STAGING_BACKEND_ROOT:backend,STAGING_RUNTIME:runtime},stdio:"inherit"});
  const routing=r.status===0&&!finalFlow?spawnSync(process.execPath,[path.join(__dirname,"common-origin-tests.cjs")],{env:{...env,STAGING_RUNTIME:runtime},stdio:"inherit"}):null;
  process.exitCode=r.status!==0?r.status??1:(finalFlow?0:routing?.status??1);stop();
 }
})().catch(error=>{console.error(error.message);stop();process.exitCode=1;});
