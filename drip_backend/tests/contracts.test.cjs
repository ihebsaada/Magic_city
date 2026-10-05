const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const { Prisma } = require("@prisma/client");
const decimal = (n) => new Prisma.Decimal(n);
let attempts=[], remoteSession,reservation;
let user, authFailure, reads, updates, stripeCalls, userReads, availableProducts, discountRule, createdData, stripeRequest;
const order = { id: "synthetic-order", orderNumber: 1, customerName: "Synthetic Customer", customerEmail: "customer@example.invalid",
  total: decimal(20), originalTotal: decimal(20), currency: "EUR", status: "PENDING", paymentStatus: "PENDING",
  discountCode: null, discountAmount: null, createdAt: new Date("2026-01-01T00:00:00Z"), updatedAt: new Date("2026-01-01T00:00:00Z"), items: [] };
const passwordHash = require("bcrypt").hashSync("synthetic-password", 4);
const product = { id:7, title:"Synthetic product", handle:"synthetic", vendor:"Synthetic", descriptionHtml:"Synthetic description", images:[{src:"https://images.example.invalid/test.jpg"}], variants:[{id:70,price:decimal(20),inventoryQuantity:5,option1:"M",option2:"Blue"}], collections:[] };
const fakePrisma = {
  user: { findUnique: async () => { userReads++; if (authFailure) throw new Error("Synthetic DB failure"); return user; } },
  order: {
    findMany: async () => { reads++; return [order]; },
    findUnique: async ({where}) => { reads++; return where.id === order.id ? {...order, ...(createdData ?? {})} : null; },
    create: async ({data}) => { updates++; attempts=[];reservation=null;remoteSession=undefined;createdData={...data,createdAt:new Date()}; return {...order, ...createdData, id: order.id}; },
    update: async ({data}) => { updates++; createdData={...(createdData??{}),...data}; return {...order, ...createdData}; },
    findUniqueOrThrow: async () => ({...order,...(createdData??{})}),
  },
  $transaction: async fn=>fn(fakePrisma), $queryRawUnsafe: async()=>[],
  paymentAttempt: {
    findFirst: async ({where})=>attempts.filter(a=>a.orderId===where.orderId && (!where.OR || where.OR.some(q=>q.sessionId===a.sessionId || q.id===a.id))).at(-1)??null,
    create: async ({data})=>{const a={...data,createdAt:new Date(),leaseUntil:null};attempts.push(a);return {...a};},
    findUniqueOrThrow: async ({where})=>({...attempts.find(a=>a.id===where.id)}),
    update: async ({where,data})=>Object.assign(attempts.find(a=>a.id===where.id),data),
    updateMany: async ({where,data})=>{const a=attempts.find(a=>a.id===where.id);if(!a || (where.sessionId===null && a.sessionId) || (where.leaseOwner && a.leaseOwner!==where.leaseOwner))return {count:0};Object.assign(a,data);return {count:1};},
  },
  paymentFinalization:{findUnique:async()=>null},
  orderReservation:{findUnique:async()=>reservation,create:async({data})=>{reservation={...data,state:"ACTIVE",items:[]};return reservation;}},
  variant:{findUniqueOrThrow:async({where})=>({...availableProducts.flatMap(p=>p.variants).find(v=>v.id===where.id),reservedQuantity:0}),update:async()=>({})},
  discount:{findUnique:async()=>discountRule?{...discountRule,reservedUses:0}:null,findUniqueOrThrow:async()=>({...discountRule,reservedUses:0}),update:async()=>({})},
  product: { findMany: async () => availableProducts, findUnique: async () => product },
  collection: { findMany: async () => [{id:1,handle:"synthetic",title:"Synthetic",_count:{products:1},products:[]}], findUnique: async () => ({id:1,handle:"synthetic",title:"Synthetic",products:[{product}]}) },
};
require.cache[require.resolve("../dist/prisma.js")] = { exports: { __esModule: true, default: fakePrisma } };
class FakeStripe {
  constructor() {
    this.checkout = { sessions: {
      create: async (params) => { stripeRequest=params; stripeCalls++; remoteSession={id:"synthetic-session",url:"https://stripe.example.invalid/pay",mode:"payment",status:"open",payment_status:"unpaid",metadata:params.metadata,amount_total:params.line_items[0].price_data.unit_amount,currency:params.line_items[0].price_data.currency};return {...remoteSession}; },
      retrieve: async () => { stripeCalls++; return {...remoteSession}; },
    } };
    this.webhooks = { constructEvent: (body, signature) => {
      assert.ok(Buffer.isBuffer(body));
      if (signature !== "synthetic-valid-signature") throw new Error("Synthetic invalid signature");
      return { id: "synthetic-event", type: "unused.synthetic", data: {object: {}} };
    }};
  }
}
require.cache[require.resolve("stripe")] = { exports: FakeStripe };
const { createApp } = require("../dist/app.js");
let server, base;
before(async () => {
  server = createApp({logging:false}).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = "http://127.0.0.1:" + server.address().port;
});
after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); });
beforeEach(() => { reservation={state:"ACTIVE",expiresAt:new Date(Date.now()+3600000),items:[]};attempts=[];remoteSession=undefined;user = { id: "synthetic-admin", email: "admin@example.invalid", passwordHash }; authFailure = false; reads = updates = stripeCalls = userReads = 0; availableProducts=[product]; discountRule=null; createdData=undefined; stripeRequest=undefined; });
const sign = (claims={}, options={}) => jwt.sign({ sub:"synthetic-admin", email:"admin@example.invalid", ...claims }, process.env.JWT_SECRET, {expiresIn:"1h", ...options});
const call = async (route, options={}) => {
  assert.ok(base.startsWith("http://127.0.0.1:")); // Only this loopback test server is contacted.
  const res = await fetch(base + "/api" + route, options);
  assert.equal(res.headers.get("cache-control"), "no-store");
  return {status:res.status, body:await res.json()};
};
const bearer = (token=sign()) => ({Authorization:"Bearer " + token});
const post = (body, headers={}) => ({ method:"POST", headers:{"Content-Type":"application/json", ...headers}, body:JSON.stringify(body) });

test("anonymous order lists, detail and admin mutation are denied without database reads", async () => {
  for (const route of ["/orders", "/admin/orders", "/admin/orders/synthetic-order", "/admin/products", "/admin/collections", "/admin/discounts"]) {
    assert.equal((await call(route)).status, 401);
  }
  assert.equal((await call("/admin/orders/synthetic-order", {method:"PATCH", headers:{"Content-Type":"application/json"}, body:'{"status":"SHIPPED"}'})).status,401);
  assert.equal(reads,0); assert.equal(updates,0); assert.equal(userReads,0);
});
test("expired, wrong signature, malformed and unsupported algorithm JWTs are denied", async () => {
  const tokens = ["garbage", sign({}, {expiresIn:-1}), jwt.sign({sub:user.id,email:user.email}, "wrong-synthetic-key"), sign({}, {algorithm:"HS384"})];
  for (const token of tokens) assert.equal((await call("/admin/orders", {headers:bearer(token)})).status,401);
  assert.equal(reads,0);
});
test("JWT payload must have valid subject, email and expiration", async () => {
  for (const token of [sign({sub:""}), sign({email:""}), jwt.sign({sub:user.id,email:user.email},process.env.JWT_SECRET), jwt.sign("synthetic",process.env.JWT_SECRET)]) {
    assert.equal((await call("/orders", {headers:bearer(token)})).status,401);
  }
  assert.equal(reads,0);
});
test("deleted admin and changed email lose authorization", async () => {
  const token=sign(); user=null;
  assert.equal((await call("/admin/orders",{headers:bearer(token)})).status,401);
  user={id:"synthetic-admin",email:"changed@example.invalid"};
  assert.equal((await call("/admin/orders",{headers:bearer(token)})).status,401);
  assert.equal(reads,0);
});
test("authorization dependency failure fails closed", async () => {
  authFailure=true;
  assert.equal((await call("/admin/orders",{headers:bearer()})).status,503); assert.equal(reads,0);
});
test("authenticated admin and protected legacy alias keep list contract", async () => {
  for (const route of ["/admin/orders","/orders"]) {
    const res=await call(route,{headers:bearer()});
    assert.equal(res.status,200); assert.equal(res.body[0].orderNumber,"#1");
    assert.deepEqual(res.body[0].customer,{name:order.customerName,email:order.customerEmail});
    assert.equal(res.body[0].total,"20.00"); assert.equal(res.body[0].status,"pending");
  }
  assert.equal(userReads,2);
});
test("admin detail and PATCH keep contract", async () => {
  const res=await call("/admin/orders/"+order.id,{headers:bearer()});
  assert.equal(res.status,200); assert.equal(res.body.total,"20.00"); assert.deepEqual(res.body.items,[]);
  assert.ok(res.body.shipping);
  const update=await call("/admin/orders/"+order.id,{method:"PATCH",headers:{"Content-Type":"application/json",...bearer()},body:'{"status":"SHIPPED"}'});
  assert.deepEqual(update.body,{ok:true,id:order.id}); assert.equal(update.status,200); assert.equal(updates,1);
});
test("guest minimal order summary remains compatible without customer data", async () => {
  const res=await call("/orders/"+order.id+"/min");
  assert.equal(res.status,200);
  assert.deepEqual(Object.keys(res.body).sort(),["id","total","currency","status","paymentStatus","createdAt"].sort());
  assert.equal(res.body.total,20); assert.equal(userReads,0);
  assert.equal((await call("/orders/missing/min")).status,404);
});
test("checkout intent contract uses synthetic persistence only", async () => {
  const res=await call("/checkout/intent",post({customerName:"Synthetic",customerEmail:"synthetic@example.invalid",items:[{productId:7,quantity:1}]}));
  assert.equal(res.status,201);
  assert.deepEqual(res.body,{orderId:order.id,redirectUrl:"https://checkout.example.invalid/checkout-landing?orderId="+order.id});
  assert.equal(stripeCalls,0);
});
test("POST orders retains public authorization and success contract", async () => {
  const res=await call("/orders",post({customerName:"Synthetic",customerEmail:"synthetic@example.invalid",items:[{productId:7,quantity:1}]}));
  assert.equal(res.status,201); assert.equal(res.body.id,order.id); assert.equal(stripeCalls,0);
});
test("payment start and unpaid confirmation use only simulated Stripe and keep contracts", async () => {
  const start=await call("/pay",post({orderId:order.id}));
  assert.deepEqual(start.body,{url:"https://stripe.example.invalid/pay",sessionId:"synthetic-session"}); assert.equal(start.status,200);
  const confirm=await call("/pay/confirm?session_id=synthetic-session");
  assert.deepEqual(confirm.body,{paid:false,payment_status:"unpaid",orderId:order.id}); assert.equal(stripeCalls,2);
});
test("validation errors and webhook retain no-store and raw signature verification", async () => {
  assert.equal((await call("/pay",post({}))).status,400);
  assert.equal((await call("/checkout/intent",post({}))).status,400);
  assert.equal((await call("/pay/confirm")).status,400);
  assert.equal((await call("/stripe/webhook",post({}))).status,400);
  const res=await call("/stripe/webhook",post({},{"stripe-signature":"synthetic-valid-signature"}));
  assert.equal(res.status,200); assert.deepEqual(res.body,{received:true});
});

test("case-insensitive order routes retain privacy and no-store", async () => {
  assert.equal((await call("/ORDERS")).status,401);
  assert.equal((await call("/ADMIN/ORDERS")).status,401);
  assert.equal((await call("/ORDERS/"+order.id+"/MIN")).status,200);
  assert.equal((await call("/PAY",post({}))).status,400);
});
test("existing login produces a token accepted by the strengthened middleware", async () => {
  const login=await call("/admin/auth/login",post({email:"admin@example.invalid",password:"synthetic-password"}));
  assert.equal(login.status,200); assert.deepEqual(login.body.user,{id:user.id,email:user.email});
  assert.equal((await call("/admin/orders",{headers:bearer(login.body.token)})).status,200);
  assert.equal((await call("/admin/auth/login",post({email:"admin@example.invalid",password:"wrong-password"}))).status,401);
});
test("public product and collection contracts survive app extraction", async () => {
  const read=async route => { const res=await fetch(base+"/api"+route); assert.equal(res.status,200); return res.json(); };
  const products=await read("/products");
  assert.ok(Array.isArray(products)); assert.equal(products[0].price,20); assert.equal(products[0].stock,5); assert.deepEqual(products[0].sizes,["M"]);
  const detail=await read("/products/handle/synthetic"); assert.equal(detail.handle,"synthetic"); assert.deepEqual(detail.images,[product.images[0].src]);
  const collections=await read("/collections"); assert.deepEqual(collections,[{id:1,handle:"synthetic",title:"Synthetic",productsCount:1}]);
  const group=await read("/collections/synthetic/products"); assert.equal(group.collection.handle,"synthetic"); assert.ok(Array.isArray(group.products));
});
test("malformed request bodies cannot bypass no-store", async () => {
  const res=await fetch(base+"/api/checkout/intent",{method:"POST",headers:{"Content-Type":"application/json"},body:"{"});
  assert.equal(res.status,400); assert.equal(res.headers.get("cache-control"),"no-store");
});

const { money, evaluateDiscount, proposedShipping } = require("../dist/services/orderPricing");
const payload=(items=[{productId:7,quantity:1,selectedSize:"M",selectedColor:"Blue"}]) => ({customerName:"Synthetic",customerEmail:"synthetic@example.invalid",items});
const preview=async(subtotal,discountCode) => {
  const res=await fetch(base+"/api/discounts/preview",post({subtotal,discountCode}));
  return {status:res.status,body:await res.json()};
};
const rule=(type="PERCENTAGE",value="10")=>({code:"TEST",active:true,expiresAt:null,usageLimit:null,usageCount:0,type,value:decimal(value)});
test("both creation endpoints reject invalid quantities before persistence",async()=>{
  for(const path of ["/checkout/intent","/orders"]) for(const quantity of [-1,0,1.5,"1",null,100,1e20]){
    assert.equal((await call(path,post(payload([{productId:7,quantity}])))).status,400);
  }
  assert.equal(updates,0); assert.equal(stripeCalls,0);
});
test("invalid ids, item containers and request limits are rejected",async()=>{
  for(const productId of [0,-1,1.5,"7",2147483648,null]) assert.equal((await call("/checkout/intent",post(payload([{productId,quantity:1}])))).status,400);
  for(const items of [[],null,{},[null],Array.from({length:101},()=>({productId:7,quantity:1}))])
    assert.equal((await call("/checkout/intent",post(payload(items)))).status,400);
  assert.equal((await call("/checkout/intent",post(payload(Array.from({length:11},()=>({productId:7,quantity:99})))))).status,400);
  assert.equal(updates,0);
});
test("customer, shipping and selection types are validated",async()=>{
  for(const patch of [{customerName:" "},{customerName:{}},{customerEmail:"invalid"},{customerEmail:"a@b.invalid\n"},{customerName:"x".repeat(201)},
    {shipping:[]},{shipping:{city:42}},{shipping:{zip:"x".repeat(33)}},{discountCode:{}},{items:[{productId:7,quantity:1,selectedSize:{}}]}]){
    assert.equal((await call("/checkout/intent",post({...payload(),...patch}))).status,400);
  }
  assert.equal(updates,0);
});
test("missing products, nonexistent and ambiguous variants never fall back",async()=>{
  availableProducts=[];
  assert.equal((await call("/checkout/intent",post(payload()))).status,400);
  availableProducts=[product];
  assert.equal((await call("/checkout/intent",post(payload([{productId:7,quantity:1,selectedSize:"L"}])))).status,400);
  availableProducts=[{...product,variants:[...product.variants,{...product.variants[0],id:71,option1:"L"}]}];
  assert.equal((await call("/checkout/intent",post(payload([{productId:7,quantity:1}])))).status,400);
  availableProducts=[{...product,variants:[product.variants[0],{...product.variants[0],id:71}]}];
  assert.equal((await call("/checkout/intent",post(payload()))).status,400);
  availableProducts=[{...product,variants:[{...product.variants[0],option3:"unsupported"}]}];
  assert.equal((await call("/checkout/intent",post(payload()))).status,400);
  assert.equal(updates,0);
});
test("duplicate variant lines cannot bypass quantity bound",async()=>{
  assert.equal((await call("/orders",post(payload([{productId:7,quantity:60},{productId:7,quantity:60}])))).status,400);
  assert.equal(updates,0);
});
test("selected variant price is authoritative and submitted prices are ignored",async()=>{
  availableProducts=[{...product,variants:[product.variants[0],{...product.variants[0],id:71,option1:"L",price:decimal("25.10")}]}];
  const input=payload([{productId:7,quantity:2,selectedSize:"L",selectedColor:"Blue",price:0.01}]);
  assert.equal((await call("/checkout/intent",post({...input,total:0.01}))).status,201);
  assert.equal(createdData.total.toFixed(2),"50.20");
  assert.equal(createdData.items.create[0].unitPrice.toFixed(2),"25.10");
  assert.equal(createdData.items.create[0].selectedSize,"L");
});
test("invalid database prices and oversized totals fail without creating an order",async()=>{
  for(const price of [null,decimal(0),decimal(-1),decimal(NaN)]){
    availableProducts=[{...product,variants:[{...product.variants[0],price}]}];
    assert.equal((await call("/checkout/intent",post(payload()))).status,400);
  }
  availableProducts=[{...product,variants:[{...product.variants[0],price:decimal("99999999.99")}]}];
  assert.equal((await call("/checkout/intent",post(payload([{productId:7,quantity:2}])))).status,400); assert.equal(updates,0);
});
test("percentage and fixed discounts share rounded preview and persisted amounts",async()=>{
  for(const [type,value] of [["PERCENTAGE","12.5"],["FIXED","1.23"]]){
    availableProducts=[{...product,variants:[{...product.variants[0],price:decimal("19.99")}]}]; discountRule=rule(type,value);
    const quoted=await preview(19.99," test ");
    assert.equal(quoted.status,200);
    assert.equal((await call("/checkout/intent",post({...payload(),discountCode:" test "}))).status,201);
    assert.equal(createdData.total.toNumber(),quoted.body.total); assert.equal(createdData.discountAmount.toNumber(),quoted.body.discountAmount);
    assert.equal(createdData.discountCode,"TEST");
  }
  assert.equal(money("1.005").toFixed(2),"1.01");
  assert.equal(evaluateDiscount(money("0.05"),"TEST",rule("PERCENTAGE","10")).discountAmount.toFixed(2),"0.01");
});
test("discounts are capped, invalid rules ignored and reasons preserved",async()=>{
  discountRule=rule("FIXED","100");
  let result=await preview(20,"TEST"); assert.equal(result.body.discountAmount,20); assert.equal(result.body.total,0);
  for(const [patch,reason] of [[{active:false},"INACTIVE"],[{expiresAt:new Date(0)},"EXPIRED"],[{usageLimit:1,usageCount:1},"LIMIT_REACHED"],
    [{value:decimal(-1)},"ERROR"],[{value:decimal(101)},"ERROR"]]){
    discountRule={...rule(),...patch}; result=await preview(20,"TEST"); assert.equal(result.body.valid,false); assert.equal(result.body.reason,reason);
    await call("/checkout/intent",post({...payload(),discountCode:"TEST"})); assert.equal(createdData.total.toNumber(),20); assert.equal(createdData.discountAmount.toNumber(),0);
  }
  discountRule=null; assert.equal((await preview(20,"TEST")).body.reason,"NOT_FOUND"); assert.equal((await preview(20,"")).body.reason,"EMPTY");
});
test("discount preview rejects malformed inputs and rounds decimal input consistently",async()=>{
  for(const subtotal of [-1,null,"20",1e20]) assert.equal((await preview(subtotal,"TEST")).status,400);
  assert.equal((await preview(20,{})).status,400);
  assert.equal((await preview(1.005,"")).body.total,1.01);
});
test("shipping policy handles 99.89 and 99.90 before discounts without activation",async()=>{
  assert.equal(proposedShipping(money("99.89")).toFixed(2),"9.90");
  assert.equal(proposedShipping(money("99.90")).toFixed(2),"0.00");
  assert.equal(proposedShipping(money("100")).toFixed(2),"0.00");
  for(const subtotal of ["99.89","99.90"]){
    availableProducts=[{...product,variants:[{...product.variants[0],price:decimal(subtotal)}]}]; discountRule=rule("PERCENTAGE","50");
    const quote=await preview(Number(subtotal),"TEST"); await call("/checkout/intent",post({...payload(),discountCode:"TEST",shipping:{address1:"Synthetic",city:"Synthetic",zip:"00000",country:"IT"}}));
    assert.equal(createdData.total.toNumber(),quote.body.total);
    await call("/pay",post({orderId:order.id}));
    assert.equal(stripeRequest.line_items[0].price_data.unit_amount,Number(createdData.total.mul(100).toFixed(0)));
  }
});
test("legacy order totals are not recalculated during payment start",async()=>{
  await call("/pay",post({orderId:order.id}));
  assert.equal(stripeRequest.line_items[0].price_data.unit_amount,2000); assert.equal(order.total.toFixed(2),"20.00");
});

test("an exhausted limited code refuses creation instead of silently increasing the quoted price",async()=>{
 discountRule={...rule(),usageLimit:1,usageCount:1};
 const result=await call("/checkout/intent",post({...payload(),discountCode:"TEST"}));
 assert.equal(result.status,409);assert.equal(result.body.error,"DISCOUNT_UNAVAILABLE");assert.equal(updates,0);
});
