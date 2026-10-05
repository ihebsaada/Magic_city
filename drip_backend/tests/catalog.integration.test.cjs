const {test,before,after}=require("node:test");
const assert=require("node:assert/strict"),{PrismaClient}=require("@prisma/client"),jwt=require("jsonwebtoken");
const db=new PrismaClient();
class FakeStripe {constructor(){this.checkout={sessions:{}};this.webhooks={};}}
require.cache[require.resolve("stripe")]={exports:FakeStripe};
const {createApp}=require("../dist/app.js"),shared=require("../dist/prisma.js").default;
const beforeP=require("./fixtures/lot8-product-before.cjs"),beforeC=require("./fixtures/lot8-collection-before.cjs");
let server,base,adminHeaders,ordered;
before(async()=>{
 await require("./catalog-fixture.cjs").seed(db);
 const user=await db.user.upsert({where:{email:"catalogue-admin@example.invalid"},update:{},create:{email:"catalogue-admin@example.invalid",passwordHash:"synthetic-only"}});
 adminHeaders={Authorization:"Bearer "+jwt.sign({sub:user.id,email:user.email},process.env.JWT_SECRET,{expiresIn:"1h"})};
 ordered=await db.product.findMany({where:{handle:{startsWith:"perf-"}},orderBy:{id:"asc"},select:{id:true,handle:true}});
 server=createApp({logging:false}).listen(0,"127.0.0.1");await new Promise(r=>server.once("listening",r));base="http://127.0.0.1:"+server.address().port;
});
after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));await db.$disconnect();await shared.$disconnect();});
async function get(path,headers={}){
 const r=await fetch(base+"/api"+path,{headers,signal:AbortSignal.timeout(15000)});
 return {status:r.status,body:await r.json()};
}
async function old(fn,params={},query={}){
 let body,status=200;await fn({params,query},{json:v=>{body=JSON.parse(JSON.stringify(v));},status:v=>{status=v;return {json:v=>{body=v;}};}});
 return {status,body};
}
const page=params=>get("/catalog/products?search=perf-&"+new URLSearchParams(params));
test("legacy products remains a 24-item array with unchanged DTO values",async()=>{
 const a=await old(beforeP.getProducts),b=await get("/products");
 assert.equal(b.status,200);assert.ok(Array.isArray(b.body));assert.equal(b.body.length,24);assert.deepEqual(b,a);
});
test("legacy limit cannot be silently reduced or bypassed by pagination parameters",async()=>{
 const a=await get("/products?pageSize=1&page=2");assert.equal(a.body.length,24);
});
test("new distinct endpoint reaches results beyond the 24th product",async()=>{
 const a=await page({page:"1",pageSize:"24"}),b=await page({page:"2",pageSize:"24"});
 assert.equal(a.status,200);assert.equal(a.body.pagination.total,3000);assert.equal(a.body.items.length,24);
 assert.equal(b.body.items[0].id,ordered[24].id);assert.ok(b.body.pagination.hasNext);
 assert.equal(new Set([...a.body.items,...b.body.items].map(x=>x.id)).size,48);
});
test("pagination last page and beyond-end page are explicit and bounded",async()=>{
 const a=await page({page:"125",pageSize:"24"}),b=await page({page:"126",pageSize:"24"});
 assert.equal(a.body.items.length,24);assert.equal(a.body.pagination.hasNext,false);assert.deepEqual(b.body.items,[]);assert.equal(b.body.pagination.total,3000);
});
test("all 3000 synthetic products are reachable without duplicates",async()=>{
 const ids=[];for(let i=1;i<=30;i++){const r=await page({page:String(i),pageSize:"100"});assert.equal(r.status,200);ids.push(...r.body.items.map(p=>p.id));}
 assert.deepEqual(ids,ordered.map(p=>p.id));
});
test("new card contract omits descriptions and includes exact variant data",async()=>{
 const r=await page({pageSize:"1"}),p=r.body.items[0];assert.equal(p.images.length,1);assert.equal(p.description,undefined);assert.equal(p.variants.length,8);
 assert.equal(p.variants[0].price,p.price);assert.equal(p.variants[0].option1,"Size1");assert.ok(p.variants[0].sku);
 assert.ok(!JSON.stringify(p).includes("reservedQuantity"));
});
test("legacy search no longer ignored and searches beyond the first 24 products",async()=>{
 const r=await get("/products?search=rareneedle");assert.equal(r.status,200);assert.equal(r.body.length,1);assert.equal(r.body[0].handle,"perf-2999");
});
test("paged search matches the same rare result",async()=>{
 const r=await get("/catalog/products?search=RAReneedle");assert.equal(r.body.pagination.total,1);assert.equal(r.body.items[0].handle,"perf-2999");
});
test("search matches vendor, handle and exact tags",async()=>{
 const a=await get("/catalog/products?search=brand03"),b=await get("/catalog/products?search=perf-1500"),c=await get("/catalog/products?search=Tag3");
 assert.equal(a.body.pagination.total,150);assert.equal(b.body.pagination.total,1);assert.equal(c.body.pagination.total,300);
});
test("search percent underscore and backslash are literal rather than SQL wildcards",async()=>{
 for(const s of ["%","_","\\"]){assert.deepEqual((await get("/products?search="+encodeURIComponent(s))).body,[]);assert.equal((await get("/catalog/products?search="+encodeURIComponent(s))).body.pagination.total,0);}
});
test("empty search behaves as no search and malformed search is rejected",async()=>{
 assert.deepEqual(await get("/products?search=%20%20"),await get("/products"));
 for(const p of ["/products?search=x&search=y","/catalog/products?search[]=x","/products?search="+"x".repeat(129)])assert.equal((await get(p)).status,400);
});
test("SQL injection payload remains data in search and vendor filters",async()=>{
 const q=encodeURIComponent("' OR 1=1 --");
 assert.equal((await get("/catalog/products?search="+q)).body.pagination.total,0);
 assert.equal((await get("/catalog/products?vendor="+q)).body.pagination.total,0);
 assert.equal(await db.product.count({where:{handle:{startsWith:"perf-"}}}),3000);
});
test("vendor and collection filters combine before hydration",async()=>{
 const r=await page({vendor:"Brand03",collection:"perf-all",pageSize:"100"});
 assert.equal(r.body.pagination.total,150);assert.ok(r.body.items.every(p=>p.brand==="Brand03"));
 const missing=await page({collection:"not-a-collection"});assert.equal(missing.body.pagination.total,0);
});
test("size and color filters must match the same exact variant",async()=>{
 const yes=await page({size:"Size1",color:"Red"}),no=await page({size:"Size1",color:"Blue"});
 assert.equal(yes.body.pagination.total,3000);assert.equal(no.body.pagination.total,0);
});
test("inStock respects the selected exact variant, including null stock",async()=>{
 const a=await page({size:"Size8",inStock:"true"}),b=await page({size:"Size8",inStock:"false"});
 assert.equal(a.body.pagination.total,0);assert.equal(b.body.pagination.total,3000);
});
test("price filters and sorting use the representative first variant",async()=>{
 const r=await page({minPrice:"15.00",maxPrice:"16.00",sort:"price-asc",pageSize:"100"});
 assert.ok(r.body.items.length>0);assert.ok(r.body.items.every(p=>p.price>=15&&p.price<=16));
 assert.ok(r.body.items.every((p,i,a)=>!i||p.price>=a[i-1].price));
});
test("price sorts are global, deterministic and cross page boundaries",async()=>{
 for(const sort of ["price-asc","price-desc"]){
  const a=await page({sort,pageSize:"24",page:"1"}),b=await page({sort,pageSize:"24",page:"2"}),items=[...a.body.items,...b.body.items];
  assert.equal(new Set(items.map(p=>p.id)).size,48);
  assert.ok(items.every((p,i,a)=>!i||(sort==="price-asc"?p.price>=a[i-1].price:p.price<=a[i-1].price)));
  assert.deepEqual(await page({sort,pageSize:"24",page:"1"}),a);
 }
});
test("name and descending ID sorts produce stable global ordering",async()=>{
 const n=await page({sort:"name",pageSize:"100"});assert.equal(n.body.items[0].handle,"perf-0001");
 const d=await page({sort:"id-desc",pageSize:"24"});assert.equal(d.body.items[0].id,ordered.at(-1).id);
});
test("sale filter uses first variant comparison and flags stay consistent",async()=>{
 const a=await page({sale:"true"}),b=await page({sale:"false"});
 assert.equal(a.body.pagination.total,3000);assert.equal(b.body.pagination.total,0);assert.ok(a.body.items.every(p=>p.isOnSale));
});
test("invalid pagination boolean sorting and pricing inputs fail explicitly",async()=>{
 for(const q of [{page:"0"},{page:"1.5"},{pageSize:"101"},{pageSize:"0"},{page:"1000001"},{sort:"price;DROP TABLE"},{minPrice:"NaN"},{minPrice:"-1"},{minPrice:"1.001"},{minPrice:"20",maxPrice:"10"},{inStock:"yes"},{sale:"1"}])
  assert.equal((await page(q)).status,400,JSON.stringify(q));
});
test("list detail ID and handle return consistent options price stock and primary image",async()=>{
 const list=await get("/products?search=perf-0001"),p=list.body[0];
 const [a,b]=await Promise.all([get("/products/"+p.id),get("/products/handle/"+p.handle)]);
 assert.deepEqual(a,b);for(const key of ["price","compareAtPrice","stock","sizes","colors","option1Name","option2Name","mainImage"])assert.deepEqual(a.body[key],p[key]);
 assert.equal(p.images.length,1);assert.equal(a.body.images.length,6);
});
test("detail historical DTO matches baseline on a standard product",async()=>{
 assert.deepEqual(await get("/products/handle/perf-1500"),await old(beforeP.getProductByHandle,{handle:"perf-1500"}));
});
test("collections retain all products and every image, with real options added",async()=>{
 const r=await get("/collections/perf-group-3/products");assert.equal(r.status,200);assert.equal(r.body.products.length,100);
 const oldResult=await old(beforeC.getCollectionProducts,{handle:"perf-group-3"});
 const normalized=r.body.products.map(({option1Name,option2Name,option3Name,...p})=>({...p,sizes:[],colors:[]}));
 assert.deepEqual(normalized,oldResult.body.products);
 assert.ok(r.body.products.every(p=>p.images.length===6&&p.sizes.length===8&&p.colors.length===2));
});
test("collection vendor filter returns 150 products without changing the envelope",async()=>{
 const r=await get("/collections/perf-all/products?vendor=Brand03");
 assert.deepEqual(Object.keys(r.body).sort(),["collection","products"]);assert.equal(r.body.products.length,150);assert.ok(r.body.products.every(p=>p.brand==="Brand03"));
});
test("collection search and vendor filter combine correctly beyond 24th item",async()=>{
 const r=await get("/collections/perf-all/products?search=RareNeedle&vendor=Brand19");
 assert.equal(r.body.products.length,1);assert.equal(r.body.products[0].handle,"perf-2999");
});
test("unknown or empty collection keeps established behavior",async()=>{
 assert.equal((await get("/collections/no-such-collection/products")).status,404);
 const c=await db.collection.create({data:{handle:"perf-empty",title:"Synthetic empty"}});
 assert.deepEqual((await get("/collections/"+c.handle+"/products")).body.products,[]);
});
test("collection brands SQL grouping preserves counts and descending ranking",async()=>{
 const r=await get("/collections/perf-all/brands"),oldResult=await old(beforeC.getCollectionBrands,{handle:"perf-all"});
 assert.equal(r.body.length,20);assert.ok(r.body.every(v=>v.count===150));assert.deepEqual([...r.body].sort((a,b)=>a.vendor.localeCompare(b.vendor)),[...oldResult.body].sort((a,b)=>a.vendor.localeCompare(b.vendor)));
 assert.equal(r.body[0].vendor,"Brand00");
});
test("public and authenticated Admin collection summaries preserve their exact contracts",async()=>{
 assert.deepEqual(await get("/collections"),await old(beforeC.getCollections));
 assert.deepEqual(await get("/admin/collections",adminHeaders),await old(beforeC.adminGetCollections));
 assert.equal((await get("/admin/collections")).status,401);
});
test("Admin product search and detail retain all fields images and variants",async()=>{
 const r=await get("/admin/products?search=RareNeedle",adminHeaders);assert.equal(r.body.length,1);
 const p=r.body[0];assert.equal(p.images.length,6);assert.equal(p.variants.length,8);assert.ok(p.descriptionHtml);assert.ok(p.createdAt);
 assert.ok(p.variants.every(v=>Object.hasOwn(v,"reservedQuantity")));
 assert.equal((await get("/admin/products/"+p.id,adminHeaders)).body.id,p.id);
});
test("Admin collection detail remains unpaginated with complete raw product data",async()=>{
 const r=await get("/admin/collections/perf-group-3",adminHeaders);assert.equal(r.status,200);assert.equal(r.body.products.length,100);
 assert.equal(r.body.products[0].variants.length,8);assert.equal(r.body.products[0].images.length,6);
});
test("unordered images and mutable variant row order are normalized explicitly",async()=>{
 const p=await db.product.create({data:{handle:"lot8-ordering",title:"Synthetic ordering",option1Name:"Size",
 images:{create:[{src:"https://images.example.invalid/third",position:3},{src:"https://images.example.invalid/first",position:1},{src:"https://images.example.invalid/second",position:2}]},
 variants:{create:[{sku:"lot8-first",price:"12.00",inventoryQuantity:5,option1:"M"},{sku:"lot8-second",price:"99.00",inventoryQuantity:1,option1:"L"}]}},include:{variants:true}});
 await db.variant.update({where:{id:p.variants[0].id},data:{inventoryQuantity:4}});
 const a=await get("/products/handle/"+p.handle);assert.equal(a.body.price,12);assert.equal(a.body.stock,5);
 assert.deepEqual(a.body.images,["https://images.example.invalid/first","https://images.example.invalid/second","https://images.example.invalid/third"]);
});
test("available stock reflects reserved null zero and finite 999 on every public read",async()=>{
 const p=await db.product.findUniqueOrThrow({where:{handle:"perf-1500"},include:{variants:{orderBy:{id:"asc"}}}});
 const r=await get("/products/handle/perf-1500"),card=await get("/catalog/products?search=perf-1500");
 assert.equal(r.body.stock,1047);assert.equal(card.body.items[0].stock,1047);
 assert.equal(card.body.items[0].variants[2].stock,8);assert.equal(card.body.items[0].variants[5].stock,999);assert.equal(card.body.items[0].variants[7].stock,0);
 const c=await get("/collections/perf-all/products?search=perf-1500");assert.equal(c.body.products[0].stock,1047);
});
test("product without variants remains unavailable with zero representative price",async()=>{
 await db.product.create({data:{handle:"lot8-no-variant",title:"Synthetic without variants"}});
 const a=await get("/products/handle/lot8-no-variant"),b=await get("/catalog/products?search=lot8-no-variant&inStock=false");
 assert.equal(a.body.stock,0);assert.equal(a.body.price,0);assert.deepEqual(b.body.items[0].variants,[]);
});
test("invalid product IDs do not produce Prisma errors",async()=>{
 for(const id of ["0","-1","1.5","2147483648","invalid"])assert.equal((await get("/products/"+id)).status,400);
 assert.equal((await get("/products/2147483647")).status,404);
});
test("legacy stock reservations and guest protection activation flags are unchanged",async()=>{
 const app=createApp({logging:false});assert.equal(app.locals.orderAccessRequired,false);assert.equal(app.locals.orderRecoveryDelivery,undefined);
 const row=await db.order.findUniqueOrThrow({where:{id:"legacy-before-migration"}});assert.equal(row.total.toFixed(2),"12.34");
});
test("measured indexes are additive and do not alter historical stock data",async()=>{
 const idx=await db.$queryRawUnsafe('SELECT indexname FROM pg_indexes WHERE indexname IN ($1,$2)',"Variant_productId_id_idx","ProductImage_productId_position_id_idx");
 assert.equal(idx.length,2);assert.equal((await db.variant.findUniqueOrThrow({where:{sku:"legacy-synthetic-999"}})).inventoryQuantity,998);
});

test("historical full collection does not truncate any of the 3000 products or galleries",async()=>{
 const r=await get("/collections/perf-all/products");assert.equal(r.status,200);assert.equal(r.body.products.length,3000);
 assert.equal(new Set(r.body.products.map(p=>p.id)).size,3000);assert.ok(r.body.products.every(p=>p.images.length===6));
});
test("stock updates remain visible without introducing a stale catalogue cache",async()=>{
 const p=await db.product.findUniqueOrThrow({where:{handle:"perf-1500"},include:{variants:{orderBy:{id:"asc"}}}}),v=p.variants[0];
 try{await db.variant.update({where:{id:v.id},data:{reservedQuantity:v.reservedQuantity+1}});
 assert.equal((await get("/products/handle/perf-1500")).body.stock,1046);
 assert.equal((await get("/catalog/products?search=perf-1500")).body.items[0].variants[0].stock,9);
 }finally{await db.variant.update({where:{id:v.id},data:{reservedQuantity:v.reservedQuantity}});}
});
test("current Admin prices propagate consistently to public list detail and paged results",async()=>{
 const p=await db.product.findUniqueOrThrow({where:{handle:"perf-1500"},include:{variants:{orderBy:{id:"asc"}}}}),v=p.variants[0];
 try{const response=await fetch(base+"/api/admin/products/"+p.id+"/default-variant",{method:"PATCH",headers:{...adminHeaders,"Content-Type":"application/json"},body:JSON.stringify({price:25.12,variantId:v.id})});assert.equal(response.status,200);
 const a=await get("/products?search=perf-1500"),b=await get("/products/handle/perf-1500"),c=await get("/catalog/products?search=perf-1500");
 assert.equal(a.body[0].price,25.12);assert.equal(b.body.price,25.12);assert.equal(c.body.items[0].price,25.12);
 }finally{await db.variant.update({where:{id:v.id},data:{price:v.price}});}
});
