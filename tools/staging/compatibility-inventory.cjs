// Read-only inventory of one explicitly named synthetic local cluster.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{createRequire}=require('node:module');
const name=process.argv[2];assert.match(name||'',/^run-[0-9]+$/);
const directory=path.join(__dirname,'.runtime',name),configuration=JSON.parse(fs.readFileSync(path.join(directory,'staging-environment.json'),'utf8'));
const url=new URL(configuration.database);assert.equal(configuration.syntheticOnly,true);assert.equal(url.hostname,'127.0.0.1');assert.equal(url.username,'magic_staging');assert.equal(url.pathname,'/magic_staging');
const backend=path.resolve(__dirname,'../../../Magic_city_backend_security/drip_backend'),req=createRequire(path.join(backend,'package.json'));
const db=new (req('@prisma/client').PrismaClient)({datasources:{db:{url:url.href}}});
(async()=>{
 const result=await db.$transaction(async tx=>{
  await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
  const orders=await tx.$queryRawUnsafe('SELECT "paymentStatus"::text AS payment, status::text AS status, total::text AS total, currency, COUNT(*)::int AS count FROM "Order" GROUP BY "paymentStatus",status,total,currency ORDER BY total');
  const rows=await tx.$queryRawUnsafe('SELECT payload,request FROM staging_simulator.sessions');
  const sessions={common:0,historical:0,open:0,paid:0,expired:0,unknownReturn:0};
  for(const {payload:s} of rows){if(s.stagingReturnBase==='http://127.0.0.1:5173/checkout/order-confirmation')sessions.common++;else if(!s.stagingReturnBase||s.stagingReturnBase==='http://127.0.0.1:5174/order-confirmation')sessions.historical++;else sessions.unknownReturn++;
   if(s.payment_status==='paid')sessions.paid++;else if(s.status==='expired'||s.expires_at*1000<=Date.now())sessions.expired++;else sessions.open++;
  }
  return {orders,sessions,idempotencyClaims:await tx.orderIdempotency.count(),paymentAttempts:await tx.paymentAttempt.count(),guestGrants:await tx.guestOrderAccess.count(),handoffs:await tx.orderHandoff.count()};
 },{isolationLevel:'RepeatableRead'});
 fs.writeFileSync(path.join(__dirname,'COMPATIBILITY_ACTIVE_INVENTORY.json'),JSON.stringify({date:new Date().toISOString(),cluster:name,readOnly:true,syntheticOnly:true,browserStorageInventoried:false,...result},null,2));
 console.log(JSON.stringify(result));
})().catch(e=>{console.error('Synthetic inventory failed: '+e.name);process.exitCode=1;}).finally(()=>db.$disconnect());
