
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const {performance}=require("node:perf_hooks"),express=require("express"),{PrismaClient}=require("@prisma/client");
const db=new PrismaClient({log:[{emit:"event",level:"query"}]});
require.cache[require.resolve("../dist/prisma.js")]={exports:{__esModule:true,default:db}};
let active;
db.$on("query",e=>{if(active)active.queries.push({query:e.query,params:e.params,duration:e.duration});});
db.$use(async(params,next)=>{const r=active,t=performance.now();try{return await next(params);}finally{if(r)r.prismaMs+=performance.now()-t;}});
const beforeProducts=require("./fixtures/lot8-product-before.cjs"),beforeCollections=require("./fixtures/lot8-collection-before.cjs");
class FakeStripe {constructor(){this.checkout={sessions:{create:()=>{throw new Error("Payment forbidden in catalogue benchmark");},retrieve:()=>{throw new Error("Payment forbidden in catalogue benchmark");}}};this.webhooks={};}}
require.cache[require.resolve("stripe")]={exports:FakeStripe};
const {createApp}=require("../dist/app.js");
const transaction=db.$transaction.bind(db);
db.$transaction=async(...args)=>{const r=active,t=performance.now(),prior=r?.prismaMs??0;try{return await transaction(...args);}finally{if(r)r.prismaMs=prior+performance.now()-t;}};
const percent=(a,p)=>[...a].sort((x,y)=>x-y)[Math.max(0,Math.ceil(a.length*p)-1)];
const summary=rows=>Object.fromEntries(["clientMs","ttfbMs","readMs","serverMs","prismaMs","postgresExecuteMs","postgresParseBindMs","serializeMs","expressResidualMs","bytes","queryCount"].map(k=>[k,{median:percent(rows.map(r=>r[k]),.5),p95:percent(rows.map(r=>r[k]),.95)}]));
function tail(file,offset){const size=fs.statSync(file).size,buf=Buffer.alloc(size-offset),fd=fs.openSync(file,"r");try{fs.readSync(fd,buf,0,buf.length,offset);return buf.toString("utf8");}finally{fs.closeSync(fd);}}
(async()=>{
 await require("./catalog-fixture.cjs").seed(db);
 const app=express(),records=new Map();
 app.use((req,res,next)=>{
  const id=req.headers["x-benchmark-id"];if(!id)return next();
  const r={start:performance.now(),prismaMs:0,serializeMs:0,queries:[]};active=r;
  res.json=value=>{const t=performance.now(),json=JSON.stringify(value);r.serializeMs=performance.now()-t;r.bytes=Buffer.byteLength(json);res.type("application/json");return res.send(json);};
  res.once("finish",()=>{r.serverMs=performance.now()-r.start;r.expressResidualMs=r.serverMs-r.prismaMs-r.serializeMs;records.set(id,r);active=undefined;});
  next();
 });
 app.get("/before/api/products",beforeProducts.getProducts);
 app.get("/before/api/products/handle/:handle",beforeProducts.getProductByHandle);
 app.get("/before/api/collections",beforeCollections.getCollections);
 app.get("/before/api/collections/:handle/products",beforeCollections.getCollectionProducts);
 app.get("/before/api/collections/:handle/brands",beforeCollections.getCollectionBrands);
 app.get("/before/api/admin/collections",require("../dist/middlewares/requireAdminAuth").requireAdminAuth,beforeCollections.adminGetCollections);
 app.use("/after",createApp({logging:false}));
 const server=app.listen(0,"127.0.0.1");await new Promise(r=>server.once("listening",r));
 const base="http://127.0.0.1:"+server.address().port,log=process.env.LOT8_PG_LOG;
 const adminUser=await db.user.upsert({where:{email:"benchmark@example.invalid"},update:{},create:{email:"benchmark@example.invalid",passwordHash:"synthetic-only"}});
 const jwt=require("jsonwebtoken").sign({sub:adminUser.id,email:adminUser.email},process.env.JWT_SECRET,{expiresIn:"1h"});
 let sequence=0;
 async function sample(mode,url){
  const id=String(++sequence),offset=fs.statSync(log).size,t=performance.now();
  const res=await fetch(base+"/"+mode+"/api"+url,{headers:{"x-benchmark-id":id,Authorization:"Bearer "+jwt},signal:AbortSignal.timeout(30000)});
  const h=performance.now(),text=await res.text(),done=performance.now();assert.equal(res.status,200,text.slice(0,100));
  const r=records.get(id);records.delete(id);assert.ok(r);
  const pg=tail(log,offset);
  let execute=0,bind=0;
  for(const line of pg.split("\n")){
   const m=/duration:\s+([0-9.]+) ms\s+(execute|statement|parse|bind)/.exec(line);
   if(m){if(m[2]==="execute"||m[2]==="statement")execute+=Number(m[1]);else bind+=Number(m[1]);}
  }
  return {...r,clientMs:done-t,ttfbMs:h-t,readMs:done-h,postgresExecuteMs:execute,postgresParseBindMs:bind,queryCount:r.queries.length};
 }
 const cases={
  products24:"/products",
  detail:"/products/handle/perf-1500",
  collection100:"/collections/perf-group-3/products",
  collection3000:"/collections/perf-all/products",
  collectionVendor150:"/collections/perf-all/products?vendor=Brand03",
  brands:"/collections/perf-all/brands",
  collections:"/collections",
  adminCollections:"/admin/collections",
  paginated24:"/catalog/products?search=perf-&page=2&pageSize=24",
  pricePage:"/catalog/products?search=perf-&sort=price-asc&pageSize=24"
 };
 const studyOnly=process.argv.includes("--index-study"),baselineOnly=process.argv.includes("--baseline-only")||studyOnly,n=baselineOnly?5:50;
 const output={date:new Date().toISOString(),fixture:{products:3000,variantsPerProduct:8,imagesPerProduct:6,collections:31,descriptionChars:45*96},samples:n,results:{}};
 try{
  if(studyOnly){
   const sampleDetail=await sample("before",cases.detail),studies=[];
   for(const candidate of [
    {name:"Variant_productId_id_idx",sql:'CREATE INDEX "Variant_productId_id_idx" ON "Variant"("productId","id")',table:"Variant"},
    {name:"ProductImage_productId_position_id_idx",sql:'CREATE INDEX "ProductImage_productId_position_id_idx" ON "ProductImage"("productId","position","id")',table:"ProductImage"}
   ]){
    await db.$executeRawUnsafe('DROP INDEX IF EXISTS "'+candidate.name+'"');
    const q=sampleDetail.queries.find(q=>q.query.includes('FROM "public"."'+candidate.table+'"'));
    assert.ok(q);
    const times=async()=>{const a=[];let last;for(let i=0;i<23;i++){const plan=await db.$queryRawUnsafe("EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) "+q.query,...JSON.parse(q.params));last=plan[0]["QUERY PLAN"][0];if(i>=3)a.push(last["Execution Time"]);}return {median:percent(a,.5),p95:percent(a,.95),plan:last};};
    const before=await times();await db.$executeRawUnsafe(candidate.sql);const after=await times();
    const study={name:candidate.name,samples:20,before,after};studies.push(study);
    console.log("INDEX "+JSON.stringify({name:candidate.name,before:before.median,after:after.median}));
   }
   fs.writeFileSync(path.join(__dirname,"catalog-index-study.json"),JSON.stringify(studies,null,2));
   return;
  }
  for(const [name,url]of Object.entries(cases)){
   output.results[name]={};
   for(const mode of name.startsWith("paginated")||name==="pricePage"?(baselineOnly?[]:["after"]):baselineOnly?["before"]:["before","after"]){
    for(const name of ["Variant_productId_id_idx","ProductImage_productId_position_id_idx"])await db.$executeRawUnsafe('DROP INDEX IF EXISTS "'+name+'"');
    if(mode==="after"){
     await db.$executeRawUnsafe('CREATE INDEX "Variant_productId_id_idx" ON "Variant"("productId","id")');
     await db.$executeRawUnsafe('CREATE INDEX "ProductImage_productId_position_id_idx" ON "ProductImage"("productId","position","id")');
    }
    for(let i=0;i<3;i++)await sample(mode,url);
    const rows=[];for(let i=0;i<n;i++)rows.push(await sample(mode,url));
    output.results[name][mode]=summary(rows);
    // Save one concrete Prisma SQL plan; query replay is separate from timing samples.
    const representative=rows.at(-1).queries.filter(q=>q.query.startsWith("SELECT"));
    output.results[name][mode].plans=[];
    for(const q of representative){
     const plan=await db.$queryRawUnsafe("EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) "+q.query,...JSON.parse(q.params));
     output.results[name][mode].plans.push({query:q.query,params:q.params,plan:plan[0]["QUERY PLAN"]});
    }
    console.log(name+" "+mode+" "+JSON.stringify(output.results[name][mode].clientMs)+" bytes="+rows[0].bytes+" queries="+rows[0].queryCount+" PG="+JSON.stringify(output.results[name][mode].postgresExecuteMs));
   }
  }
  const file=baselineOnly?"catalog-baseline.json":"catalog-performance.json";
  fs.writeFileSync(path.join(__dirname,file),JSON.stringify(output,null,2));
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));await db.$disconnect();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
