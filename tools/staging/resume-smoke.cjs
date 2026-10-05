const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict"),{createRequire}=require("node:module");
const u=new URL(process.env.DATABASE_URL);assert.equal(u.hostname,"127.0.0.1");assert.equal(u.username,"magic_staging");
const requireBackend=createRequire(path.join(process.env.STAGING_BACKEND_ROOT,"package.json")),{PrismaClient}=requireBackend("@prisma/client"),db=new PrismaClient();
const fixture=JSON.parse(fs.readFileSync(path.join(process.env.STAGING_RUNTIME,"scenario-private.json"),"utf8"));
async function request(p,token,body,key){const r=await fetch("http://127.0.0.1:4100/api"+p,{method:body?"POST":"GET",headers:{"Content-Type":"application/json","Order-Access-Token":token,...(key?{"Idempotency-Key":key}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,body:await r.json()};}
(async()=>{
 const before={orders:await db.order.count(),finalizations:await db.paymentFinalization.count(),sessions:(await db.$queryRawUnsafe("SELECT COUNT(*)::int AS count FROM staging_simulator.sessions"))[0].count,discount:(await db.discount.findUniqueOrThrow({where:{code:"STAGE10"}})).usageCount};
 for(const a of [fixture.a,fixture.b]){const r=await request("/checkout/intent",a.token,a.body,a.key);assert.equal(r.status,201);assert.equal(r.body.orderId,a.id);}
 const c=await request("/pay/confirm?session_id="+fixture.payResult.sessionId,fixture.a.checkoutToken);assert.equal(c.status,200);assert.equal(c.body.paid,true);
 assert.equal((await request("/pay",fixture.a.checkoutToken,{orderId:fixture.a.id})).status,409);
 const after={orders:await db.order.count(),finalizations:await db.paymentFinalization.count(),sessions:(await db.$queryRawUnsafe("SELECT COUNT(*)::int AS count FROM staging_simulator.sessions"))[0].count,discount:(await db.discount.findUniqueOrThrow({where:{code:"STAGE10"}})).usageCount};
 assert.deepEqual(after,before);
 console.log("PASS restart: same key/body/token replays two existing orders, paid session confirms, no duplicate order/session/discount.");
 fs.writeFileSync(path.join(__dirname,"STAGING_RESTART_RESULTS.json"),JSON.stringify({date:new Date().toISOString(),status:"PASS",browserExecuted:false,ordersAndSessionsUnchanged:true},null,2));
})().catch(e=>{console.error("Restart verification failed: "+e.name);process.exitCode=1;}).finally(()=>db.$disconnect());
