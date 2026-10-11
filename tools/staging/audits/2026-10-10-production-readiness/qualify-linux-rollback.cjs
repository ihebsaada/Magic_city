// Local Docker only. New no-network PostgreSQL; no published port, credentials or deployment.
const fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto');
const base=path.resolve(process.argv[2]||'');if(!base.startsWith(path.join(__dirname,'release-review','rollback-')))throw Error('Selected source artifact required');
const source=path.join(base,'backend'),docker='C:/Users/hp/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe',stamp=path.basename(base).slice(9),q='magiccity-policy-rollback:qualification-'+stamp,runtime='magiccity-policy-rollback:linux-'+stamp;let pg='magiccity-rollback-qualification-'+Date.now();
const env={};for(const k of ['PATH','Path','SystemRoot','TEMP','TMP'])if(process.env[k])env[k]=process.env[k];
const results=[];let started=false;
function d(args,label,must=true){const r=cp.spawnSync(docker,['--host','npipe:////./pipe/dockerDesktopLinuxEngine',...args],{env,encoding:'utf8',maxBuffer:30e6,timeout:240000});if(label){fs.writeFileSync(path.join(base,label+'.log'),(r.stdout||'')+(r.stderr||''));results.push({label,exit:r.status});console.log(label+'='+r.status);}if(must&&r.status!==0)throw Error('Qualification failed; inspect '+label);return r;}
const variables={NODE_ENV:'test',DATABASE_URL:'postgresql://lot4_test@127.0.0.1:5432/lot4_isolated',JWT_SECRET:'synthetic-only-signing-key',STRIPE_SECRET_KEY:'sk_test_synthetic_only',STRIPE_WEBHOOK_SECRET:'whsec_synthetic_only',NAVIGATION_HANDOFF_SECRET:'synthetic-navigation-secret-at-least-32',CHECKOUT_APP_URL:'https://checkout.example.invalid',STRIPE_SUCCESS_URL:'https://checkout.example.invalid/order-confirmation?orderId={ORDER_ID}&session_id={CHECKOUT_SESSION_ID}',STRIPE_CANCEL_URL:'https://checkout.example.invalid/checkout-landing?orderId={ORDER_ID}'};
const e=Object.entries(variables).flatMap(([k,v])=>['-e',k+'='+v]);
const runQ=(args,label)=>d(['run','--rm','--network','container:'+pg,...e,q,...args],label);
const runR=(args,label)=>d(['run','--rm','--network','container:'+pg,...e,'--mount','type=bind,source='+path.join(source,'tests')+',target=/app/tests,readonly',runtime,...args],label);
(async()=>{try{
 for(const f of JSON.parse(fs.readFileSync(path.join(base,'MANIFEST.json'))).files)if(crypto.createHash('sha256').update(fs.readFileSync(path.join(source,f.file))).digest('hex')!==f.sha256)throw Error('Source snapshot mismatch');
 d(['build','--target','runtime','-t',runtime,source],'linux-runtime-build');
 d(['run','--rm','--network','none',q,'node','tests/run-tests.cjs'],'linux-unit-tests');
 d(['run','-d','--pull','never','--name',pg,'--network','none','--tmpfs','/var/lib/postgresql:rw','-e','POSTGRES_USER=lot4_test','-e','POSTGRES_DB=lot4_isolated','-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:18'],'pg-new');started=true;
 let ready=false;for(let i=0;i<80;i++){if(d(['exec',pg,'pg_isready','-h','127.0.0.1','-U','lot4_test','-d','lot4_isolated'],null,false).status===0){ready=true;break;}await new Promise(r=>setTimeout(r,300));}if(!ready)throw Error('New PG not ready');
 const version=d(['exec',pg,'psql','-h','127.0.0.1','-U','lot4_test','-d','lot4_isolated','-Atc','SHOW server_version'],'pg-version').stdout.trim();if(!/^18\.6(?: |$)/.test(version))throw Error('PG 18.6 required');
 const baseline="const fs=require('fs'),cp=require('child_process');fs.cpSync('prisma','/tmp/baseline',{recursive:true,filter:p=>!p.includes('20261010120000_add_secure_order_policy')});const r=cp.spawnSync(process.execPath,['node_modules/prisma/build/index.js','migrate','deploy','--schema','/tmp/baseline/schema.prisma'],{stdio:'inherit'});process.exitCode=r.status;";
 runQ(['node','-e',baseline],'linux-baseline-migrations');
 const oldRunner=fs.readFileSync(path.join(__dirname,'secure-policy/run-regression-pg18.cjs'),'utf8'),seedLiteral=oldRunner.match(/const seed=("(?:[^"\\]|\\.)*");must\(run/);if(!seedLiteral)throw Error('Reviewed fixture not found');
 runQ(['node','-e',JSON.parse(seedLiteral[1])],'linux-historical-fixture');
 const policySeed="const {PrismaClient}=require('@prisma/client'),d=new PrismaClient();d.order.create({data:{id:'policy-historical-before-migration',stripeSessionId:'cs_test_policy_historical',customerName:'Synthetic',customerEmail:'synthetic@example.invalid',total:'12.34',items:{create:{productTitle:'Synthetic',productHandle:'synthetic',quantity:1,unitPrice:'12.34'}}}}).finally(()=>d.$disconnect());";
 const hash="const {PrismaClient}=require('@prisma/client'),d=new PrismaClient();(async()=>{const o=await d.order.findMany({where:{id:{in:['legacy-before-migration','policy-historical-before-migration']}},orderBy:{id:'asc'},include:{items:{orderBy:{id:'asc'}}}});console.log(require('crypto').createHash('sha256').update(JSON.stringify(o)).digest('hex'));})().finally(()=>d.$disconnect());";
 const before=runQ(['node','-e',hash],'linux-historical-before').stdout.trim();
 runQ(['node','node_modules/prisma/build/index.js','migrate','deploy'],'linux-policy-migration');
 for(const suite of ['idempotency','payment','reservations','guest-access','handoff','navigation','catalog'])runR(['node','--test','tests/'+suite+'.integration.test.cjs'],'linux-'+suite);
 const after=runQ(['node','-e',hash],'linux-historical-after').stdout.trim();if(before!==after)throw Error('Historical snapshot changed');
 // Existing regression suites deliberately reset synthetic fixtures. Policy suite gets
 // its own NEW database, exactly as the existing Windows runners do.
 d(['stop',pg],'pg-regression-stop');started=false;pg+='-policy';
 d(['run','-d','--pull','never','--name',pg,'--network','none','--tmpfs','/var/lib/postgresql:rw','-e','POSTGRES_USER=lot4_test','-e','POSTGRES_DB=lot4_isolated','-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:18'],'pg-policy-new');started=true;
 ready=false;for(let i=0;i<80;i++){if(d(['exec',pg,'pg_isready','-h','127.0.0.1','-U','lot4_test','-d','lot4_isolated'],null,false).status===0){ready=true;break;}await new Promise(r=>setTimeout(r,300));}if(!ready)throw Error('New policy PG not ready');
 runQ(['node','-e',baseline],'linux-policy-baseline');runQ(['node','-e',policySeed],'linux-policy-fixture');
 const policyBefore=runQ(['node','-e',hash],'linux-policy-before').stdout.trim();
 runQ(['node','node_modules/prisma/build/index.js','migrate','deploy'],'linux-policy-schema');
 runR(['node','--test','tests/secure-order-policy.integration.test.cjs'],'linux-secure-order-policy');
 if(runQ(['node','-e',hash],'linux-policy-after').stdout.trim()!==policyBefore)throw Error('Historical policy fixture changed');
 runR(['node','tests/run-tests.cjs'],'linux-runtime-unit-tests');
 runR(['node','-e',"const fs=require('fs'),assert=require('assert/strict');for(const f of ['paymentService','guestOrderAccess','reservations','navigationHandoff','orderHandoff','reservationReconciliation'])assert.ok(fs.readFileSync('dist/services/'+f+'.js','utf8').includes('requireSecureOrder'));assert.ok(fs.readFileSync('dist/controllers/stripeWebhookController.js','utf8').includes('historicalWebhookReceipt'));const v=require('./dist/stripeApiVersion');assert.equal(v.SUPPORTED_STRIPE_API_VERSION,require('stripe').API_VERSION);for(const x of [undefined,'',require('stripe').API_VERSION])v.validateStripeApiVersion(x);assert.throws(()=>v.validateStripeApiVersion('2020-01-01'));assert.throws(()=>require('./dist/productionConfiguration').requireProductionLegacyReadiness(),/PRODUCTION_LEGACY_ACCESS_REVIEW_REQUIRED/);require('bcrypt').hashSync('synthetic',4);console.log('RUNTIME_GUARDS_STRIPE_BLOCKER_NATIVE_MODULES=PASS');"],'linux-runtime-guards');
 const inspect=JSON.parse(d(['image','inspect',runtime],'linux-image-inspect').stdout)[0];if(inspect.Config.User!=='node')throw Error('Runtime must be non-root');
 d(['save','--output',path.join(base,'backend-policy-aware-linux.tar'),runtime],'linux-image-export');
 d(['load','--input',path.join(base,'backend-policy-aware-linux.tar')],'linux-image-load');
 if(JSON.parse(d(['image','inspect',runtime]).stdout)[0].Id!==inspect.Id)throw Error('Loaded image identity changed');
 const artifact=path.join(base,'backend-policy-aware-linux.tar');const bytes=fs.readFileSync(artifact);fs.writeFileSync(path.join(base,'LINUX_ARTIFACT.json'),JSON.stringify({image:runtime,imageId:inspect.Id,os:inspect.Os,architecture:inspect.Architecture,node:'24.19.0',pgVersion:version,productionBlocked:true,historicalSnapshotsUnchanged:true,path:artifact,size:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),results},null,2));
 }finally{if(started)d(['stop',pg],'pg-stop',false);fs.writeFileSync(path.join(base,'LINUX_RESULTS.json'),JSON.stringify(results,null,2));}})().catch(e=>{console.error(e.message);process.exitCode=1;});
