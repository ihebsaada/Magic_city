// Local source artifact only: no deploy, DB or external provider calls.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),cp=require('child_process');
const backend=path.resolve(__dirname,'../../../../../Magic_city_backend_security/drip_backend');
const output=path.join(__dirname,'release-review','rollback-'+Date.now()),source=path.join(output,'backend');
fs.mkdirSync(source,{recursive:true});
const selected=[];
function walk(dir){for(const entry of fs.readdirSync(path.join(backend,dir),{withFileTypes:true})){const file=path.posix.join(dir,entry.name);if(entry.isDirectory())walk(file);else selected.push(file);}}
walk('src');walk('prisma');
for(const file of ['package.json','package-lock.json','tsconfig.json'])selected.push(file);
// Explicit allowlist: never traverse old .pg-* clusters or generated test evidence.
for(const file of fs.readdirSync(path.join(backend,'tests')))if(file.endsWith('.cjs'))selected.push('tests/'+file);
for(const file of fs.readdirSync(path.join(backend,'tests/fixtures')))if(file.endsWith('.cjs'))selected.push('tests/fixtures/'+file);
const files=[];
for(const file of selected){const bytes=fs.readFileSync(path.join(backend,file)),text=bytes.toString();
 if(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|(?:sk_live_|sk_test_|whsec_)[A-Za-z0-9]{24,}/.test(text))throw Error('Secret review required: '+file);
 for(const m of text.matchAll(/postgres(?:ql)?:\/\/[^\s'"`]+/g)){let u;try{u=new URL(m[0])}catch{continue}if(u.password&&!['localhost','127.0.0.1'].includes(u.hostname)&&!u.hostname.endsWith('.invalid'))throw Error('Credential review required: '+file);}
 const target=path.join(source,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);files.push({file,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});}
for(const file of ['paymentService','guestOrderAccess','reservations','navigationHandoff','orderHandoff','reservationReconciliation'])if(!fs.readFileSync(path.join(source,'src/services/'+file+'.ts'),'utf8').includes('requireSecureOrder'))throw Error('Missing guard '+file);
if(!fs.readFileSync(path.join(source,'src/productionConfiguration.ts'),'utf8').includes('PRODUCTION_LEGACY_ACCESS_REVIEW_REQUIRED'))throw Error('Startup blocker missing');
fs.writeFileSync(path.join(output,'MANIFEST.json'),JSON.stringify({sourceOnly:true,requiresReviewedBuild:true,productionBlocked:true,files},null,2));
console.log(output);
