const {test,before,after,beforeEach}=require("node:test");
const assert=require("node:assert/strict");
const {fork}=require("node:child_process");
const {PrismaClient}=require("@prisma/client");
const db=new PrismaClient();
let child,base,product,legacy;
async function start(){
  child=fork(require.resolve("./integration-server.cjs"),[],{env:process.env,stdio:["ignore","ignore","inherit","ipc"]});
  const port=await new Promise((resolve,reject)=>{child.once("message",m=>resolve(m.port));child.once("error",reject);child.once("exit",()=>reject(new Error("Server stopped before startup")));});
  base="http://127.0.0.1:"+port;
}
async function stop(){const process=child;if(!process)return;await new Promise(resolve=>{process.once("exit",resolve);process.send("stop");});child=undefined;}
before(async()=>{
  assert.match(process.env.DATABASE_URL,/^postgresql:\/\/lot4_test@127\.0\.0\.1:\d+\/lot4_isolated$/);
  product=await db.product.create({data:{handle:"synthetic",title:"Synthetic",variants:{create:{price:"20.00",inventoryQuantity:5,option1:"M",option2:"Blue"}}}});
  legacy=await db.order.findUniqueOrThrow({where:{id:"legacy-before-migration"}});
  await start();
});
after(async()=>{await stop();await db.$disconnect();});
beforeEach(async()=>{await db.stockReservationItem.deleteMany();await db.orderReservation.deleteMany();
 await db.variant.updateMany({data:{reservedQuantity:0}});
 await db.orderIdempotency.deleteMany();await db.orderItem.deleteMany({where:{orderId:{not:legacy.id}}});await db.order.deleteMany({where:{id:{not:legacy.id}}});await db.variant.updateMany({where:{productId:product.id},data:{inventoryQuantity:5}});});
const body=()=>({customerName:"Synthetic",customerEmail:"synthetic@example.invalid",items:[{productId:product.id,quantity:1,selectedSize:"M",selectedColor:"Blue"}]});
const call=async(key,data=body(),path="/checkout/intent",extra={})=>{
  const res=await fetch(base+"/api"+path,{method:"POST",headers:{"Content-Type":"application/json",...(key?{"Idempotency-Key":key}:{}),...extra},body:JSON.stringify(data),signal:AbortSignal.timeout(10000)});
  assert.equal(res.headers.get("cache-control"),"no-store");
  return {status:res.status,body:await res.json(),replayed:res.headers.get("idempotency-replayed")};
};
const orders=()=>db.order.count({where:{id:{not:legacy.id}}});
test("same key and canonical request returns the original response even after price changes",async()=>{
  const key="synthetic_same_key_001"; const first=await call(key);
  await db.variant.updateMany({where:{productId:product.id},data:{price:"25.00"}});
  const replay=await call(key,{items:body().items,customerEmail:"synthetic@example.invalid",customerName:" Synthetic ",discountCode:""});
  assert.equal(first.status,201);assert.deepEqual(replay.body,first.body);assert.equal(replay.replayed,"true");assert.equal(await orders(),1);
  await db.variant.updateMany({where:{productId:product.id},data:{price:"20.00"}});
});
test("same key with different payload or endpoint returns conflict",async()=>{
  const key="synthetic_conflict_001";await call(key);
  assert.equal((await call(key,{...body(),items:[{...body().items[0],quantity:2}]})).status,409);
  assert.equal((await call(key,body(),"/orders")).status,409);assert.equal(await orders(),1);
});
test("simultaneous HTTP requests use PostgreSQL uniqueness and create one order",async()=>{
  const results=await Promise.all([call("synthetic_concurrent_001"),call("synthetic_concurrent_001")]);
  assert.equal(results[0].status,201);assert.equal(results[1].status,201);assert.deepEqual(results[0].body,results[1].body);
  assert.deepEqual(results.map(x=>x.replayed).sort(),["false","true"]);
  assert.equal(await orders(),1);assert.equal(await db.orderIdempotency.count(),1);
});
test("response lost after commit can be recovered with the same key",async()=>{
  const key="synthetic_lost_response_001";
  await assert.rejects(call(key,body(),"/checkout/intent",{"x-test-drop-response":"yes"}));
  assert.equal(await orders(),1);
  const retry=await call(key);assert.equal(retry.status,201);assert.equal(retry.replayed,"true");assert.equal(await orders(),1);
});
test("restart of the server process preserves the key and exact response",async()=>{
  const key="synthetic_restart_001";const first=await call(key);
  await stop();await start();
  const second=await call(key);assert.deepEqual(second.body,first.body);assert.equal(second.replayed,"true");assert.equal(await orders(),1);
});
test("two legitimate identical purchases with distinct keys create two orders",async()=>{
  const a=await call("synthetic_purchase_A_001");const b=await call("synthetic_purchase_B_001");
  assert.notEqual(a.body.orderId,b.body.orderId);assert.equal(await orders(),2);
});
test("rollback removes the claim when product validation fails",async()=>{
  const key="synthetic_rollback_001";
  const bad={...body(),items:[{productId:2147483647,quantity:1}]};
  assert.equal((await call(key,bad)).status,400);assert.equal(await db.orderIdempotency.count(),0);assert.equal(await orders(),0);
  assert.equal((await call(key)).status,201);
});
test("expired key is a tombstone and never creates another order",async()=>{
  const key="synthetic_expired_001";await call(key);
  await db.orderIdempotency.updateMany({data:{replayUntil:new Date(0)}});
  const res=await call(key);assert.equal(res.status,410);assert.equal(res.body.error,"IDEMPOTENCY_EXPIRED");assert.equal(await orders(),1);
});
test("optional key preserves legacy behavior and invalid key is rejected",async()=>{
  await call(undefined);await call(undefined);assert.equal(await orders(),2);
  assert.equal((await call("too-short")).status,400);assert.equal(await orders(),2);
});
test("POST orders also returns an immutable stored response",async()=>{
  const key="synthetic_direct_order_001";
  const first=await call(key,body(),"/orders");
  await db.order.update({where:{id:first.body.id},data:{status:"SHIPPED"}});
  const second=await call(key,body(),"/orders");assert.deepEqual(second.body,first.body);assert.equal(await orders(),1);
});
test("migration preserves the old order and uniqueness is enforced by the database",async()=>{
  const old=await db.order.findUnique({where:{id:legacy.id}});assert.equal(old.total.toFixed(2),"12.34");
  await db.orderIdempotency.create({data:{keyHash:"a".repeat(64),requestHash:"b".repeat(64),endpoint:"intent",replayUntil:new Date(Date.now()+10000)}});
  await assert.rejects(db.orderIdempotency.create({data:{keyHash:"a".repeat(64),requestHash:"c".repeat(64),endpoint:"intent",replayUntil:new Date(Date.now()+10000)}}),error=>error.code==="P2002");
});
test("canonical item order and split lines replay without changing original response",async()=>{
  const key="synthetic_canonical_001";
  const first=await call(key,{...body(),items:[{...body().items[0],quantity:2}]});
  const second=await call(key,{...body(),items:[body().items[0],body().items[0]]});
  assert.deepEqual(first.body,second.body);assert.equal(await orders(),1);
});

test("client timeout during creation can be resumed after the transaction completes",async()=>{
  let release,markLocked;
  const unlocked=new Promise(resolve=>{release=resolve;});
  const locked=new Promise(resolve=>{markLocked=resolve;});
  const holder=db.$transaction(async tx=>{
    await tx.$executeRawUnsafe('LOCK TABLE "Order" IN ACCESS EXCLUSIVE MODE');
    markLocked();await unlocked;
  });
  await locked;
  try {
    await assert.rejects(fetch(base+"/api/checkout/intent",{method:"POST",headers:{"Content-Type":"application/json","Idempotency-Key":"synthetic_timeout_001"},
      body:JSON.stringify(body()),signal:AbortSignal.timeout(100)}));
  } finally { release();await holder; }
  const hash=require("node:crypto").createHash("sha256").update("synthetic_timeout_001").digest("hex");
  let stored;
  for(let i=0;i<100;i++){stored=await db.orderIdempotency.findUnique({where:{keyHash:hash}});if(stored)break;await new Promise(resolve=>setTimeout(resolve,20));}
  assert.ok(stored);assert.ok(stored.response);
  const retry=await call("synthetic_timeout_001");assert.equal(retry.replayed,"true");assert.equal(await orders(),1);
});
test("concurrent different requests with the same key create one order and conflict",async()=>{
  const results=await Promise.all([call("synthetic_race_conflict_001"),call("synthetic_race_conflict_001",{...body(),items:[{...body().items[0],quantity:2}]})]);
  assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);assert.equal(await orders(),1);
});

test("expired response snapshots can be purged while the key remains blocked",async()=>{
  const key="synthetic_purge_001";await call(key);
  await db.orderIdempotency.updateMany({data:{replayUntil:new Date(0)}});
  const {purgeExpiredIdempotencyResponses}=require("../dist/services/orderIdempotency");
  const result=await purgeExpiredIdempotencyResponses();assert.equal(result.count,1);
  const record=await db.orderIdempotency.findFirst();assert.equal(record.response,null);assert.ok(record.orderId);
  assert.equal((await call(key)).status,410);assert.equal(await orders(),1);
});
test("CORS preflight allows the optional idempotency header",async()=>{
  const res=await fetch(base+"/api/checkout/intent",{method:"OPTIONS",headers:{Origin:"https://store.example.invalid","Access-Control-Request-Method":"POST","Access-Control-Request-Headers":"content-type,idempotency-key"}});
  assert.equal(res.status,204);assert.match(res.headers.get("access-control-allow-headers"),/idempotency-key/i);
});
