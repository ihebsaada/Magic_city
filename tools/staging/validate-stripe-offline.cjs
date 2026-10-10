const fs=require('node:fs'),cp=require('node:child_process'),path=require('node:path');
const base=path.resolve(__dirname,'../..'),out=path.join(__dirname,'audits/2026-10-10-production-readiness/release-review/stripe-offline');fs.mkdirSync(out,{recursive:true});
const env={};for(const k of ['PATH','Path','SystemRoot','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA'])if(process.env[k])env[k]=process.env[k];
// Child processes never inherit PG_*, Stripe, JWT, dotenv or NODE_OPTIONS values.
env.DATABASE_URL='postgresql://synthetic:synthetic@127.0.0.1:1/synthetic';
const results=[];let started=false;
function run(exe,args,cwd,label,input){const r=cp.spawnSync(exe,args,{cwd,env,input,encoding:'utf8',timeout:180000,maxBuffer:16e6});if(label){fs.writeFileSync(path.join(out,label+'.log'),(r.stdout||'')+(r.stderr||''));results.push({label,exit:r.status});console.log(label+'='+r.status);}if(r.status!==0)throw Error('LOCAL_CHECK_FAILED: '+label);return r;}
const docker='C:/Users/hp/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe',container='magiccity-offline-readonly-'+Date.now();
const d=(args,label,input)=>run(docker,['--host','npipe:////./pipe/dockerDesktopLinuxEngine',...args],base,label,input);
(async()=>{try{
 const backend=path.resolve(base,'../Magic_city_backend_security/drip_backend');
 run(process.execPath,['node_modules/typescript/bin/tsc'],backend,'backend-build');
 run(process.execPath,['--test','--test-reporter=tap','tools/staging/offline-stripe.test.cjs'],base,'offline-stripe');
 for(const [app,root]of [['store',path.join(base,'drip_frontend')],['checkout',path.resolve(base,'../Magic_city_checkout_security/seamless_checkout_flow')]])
  run(process.execPath,['node_modules/vite/bin/vite.js','build','--mode','staging','--outDir',path.join(out,app+'-build')],root,app+'-build');
 // PostgreSQL platform probe only: no schemas, fixtures, migrations or application data.
 d(['run','-d','--network','none','--name',container,'--tmpfs','/var/lib/postgresql:rw','-e','POSTGRES_DB=postgres','-e','POSTGRES_USER=synthetic_audit','-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:18'],'pg-start');started=true;
 let ready=false;for(let i=0;i<60;i++){const r=cp.spawnSync(docker,['--host','npipe:////./pipe/dockerDesktopLinuxEngine','exec',container,'pg_isready','-h','127.0.0.1','-U','synthetic_audit','-d','postgres'],{env,encoding:'utf8'});if(r.status===0){ready=true;break;}await new Promise(r=>setTimeout(r,500));}if(!ready)throw Error('PG_LOCAL_NOT_READY');
 const sql="BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SELECT 1 / CASE WHEN current_database()='postgres' AND current_setting('server_version_num')::int/10000=18 AND current_setting('transaction_read_only')='on' THEN 1 ELSE 0 END AS guard; SELECT current_setting('server_version'),current_setting('transaction_read_only'); ROLLBACK;";
 d(['exec','-i',container,'psql','-X','-w','-h','127.0.0.1','-U','synthetic_audit','-d','postgres','-v','ON_ERROR_STOP=1','-f','-'],'pg-readonly',sql);
 }finally{
  if(started)d(['stop',container],'pg-stop');
  fs.writeFileSync(path.join(out,'RESULTS.json'),JSON.stringify({migrationExecuted:false,remoteAccess:false,postgresApplicationTestsExecuted:false,results},null,2));
 }} )().catch(()=>{console.error('OFFLINE_VALIDATION_STOPPED; inspect local logs.');process.exitCode=1;});
