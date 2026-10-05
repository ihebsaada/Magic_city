const fs=require("node:fs");const path=require("node:path");const {spawnSync}=require("node:child_process");const net=require("node:net");
const root=path.resolve(__dirname,".."),pg=process.env.PG_TEST_BIN||"C:/Program Files/PostgreSQL/17/bin";
const run=(exe,args,env)=>{const result=spawnSync(exe,args,{cwd:root,env,encoding:"utf8",stdio:exe.endsWith("pg_ctl.exe")?"ignore":"pipe",timeout:60000});if(result.status!==0)throw new Error(result.error?.message || (result.stdout||"")+(result.stderr||"") || "Command failed: "+exe);return result;};
(async()=>{
  const data=path.join(root,"tests",".pg-lot4-"+Date.now()),log=path.join(data,"server.log");
  const env={};for(const key of ["PATH","Path","SystemRoot","TEMP","TMP"])if(process.env[key])env[key]=process.env[key];
  Object.assign(env,{NODE_ENV:"test",JWT_SECRET:"synthetic-only-signing-key",STRIPE_SECRET_KEY:"sk_test_synthetic_not_a_real_key",STRIPE_WEBHOOK_SECRET:"synthetic",CHECKOUT_APP_URL:"https://checkout.example.invalid",STRIPE_SUCCESS_URL:"https://checkout.example.invalid/success?orderId={ORDER_ID}",STRIPE_CANCEL_URL:"https://checkout.example.invalid/cancel?orderId={ORDER_ID}"});
  const port=await new Promise(resolve=>{const socket=net.createServer();socket.listen(0,"127.0.0.1",()=>{const port=socket.address().port;socket.close(()=>resolve(port));});});
  let started=false;
  try{
    console.log("Initializing a new isolated cluster");
    run(path.join(pg,"initdb.exe"),["-D",data,"-U","lot4_test","-A","trust","--encoding=UTF8","--no-locale"],env);
    console.log("Starting isolated PostgreSQL on loopback");
    run(path.join(pg,"pg_ctl.exe"),["-D",data,"-l",log,"-o","-h 127.0.0.1 -c log_min_duration_statement=0 -p "+port,"-w","start"],env);started=true;
    run(path.join(pg,"createdb.exe"),["-h","127.0.0.1","-p",String(port),"-U","lot4_test","lot4_isolated"],env);
    env.LOT8_PG_LOG=log;
    env.DATABASE_URL="postgresql://lot4_test@127.0.0.1:"+port+"/lot4_isolated";
    const cli=require.resolve("prisma/build/index.js");
    // Apply the production migration history first, seed a legacy synthetic order, then apply the new additive migration.
    const baseline=path.join(data,"baseline");fs.mkdirSync(baseline);
    fs.copyFileSync(path.join(root,"prisma","schema.prisma"),path.join(baseline,"schema.prisma"));
    fs.cpSync(path.join(root,"prisma","migrations"),path.join(baseline,"migrations"),{recursive:true,filter:source=>!["20261003120000_add_order_idempotency","20261004120000_add_payment_attempts","20261004160000_add_stock_reservations","20261004190000_add_guest_order_access","20261004210000_product_read_indexes","20261004230000_add_order_handoff"].includes(path.basename(source))});
    console.log("Applying baseline migrations only to lot4_isolated");
    run(process.execPath,[cli,"migrate","deploy","--schema",path.join(baseline,"schema.prisma")],env);
    run(process.execPath,["-e","const {PrismaClient}=require(\"@prisma/client\");const db=new PrismaClient();(async()=>{\nawait db.order.create({data:{id:\"legacy-before-migration\",customerName:\"Legacy Synthetic\",customerEmail:\"legacy@example.invalid\",total:\"12.34\",currency:\"EUR\"}});\nawait db.$executeRawUnsafe('INSERT INTO \"Product\" (\"handle\",\"title\",\"updatedAt\") VALUES ($1,$2,CURRENT_TIMESTAMP)',\"legacy-stock-before-migration\",\"Legacy Synthetic Stock\");\nconst p=await db.$queryRawUnsafe('SELECT \"id\" FROM \"Product\" WHERE \"handle\"=$1',\"legacy-stock-before-migration\");\nawait db.$executeRawUnsafe('INSERT INTO \"Variant\" (\"productId\",\"price\",\"sku\") VALUES ($1,20,$2)',p[0].id,\"legacy-synthetic-999\");\nawait db.$executeRawUnsafe('INSERT INTO \"Variant\" (\"productId\",\"price\",\"inventoryQuantity\") VALUES ($1,20,NULL),($1,20,0)',p[0].id);\nawait db.orderItem.create({data:{orderId:\"legacy-before-migration\",productId:p[0].id,productTitle:\"Legacy Synthetic Stock\",productHandle:\"legacy-stock-before-migration\",quantity:1,unitPrice:\"12.34\",variantSku:\"legacy-synthetic-999\"}});\n})().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>db.$disconnect());"],env);
    console.log("Applying the additive idempotency migration to the isolated database");
    run(process.execPath,[cli,"migrate","deploy"],env);
    const files=(process.argv.includes("--catalog-baseline")||process.argv.includes("--catalog-indexes")||process.argv.includes("--catalog-benchmark"))?["tests/catalog-benchmark.cjs"]:["tests/idempotency.integration.test.cjs","tests/payment.integration.test.cjs","tests/reservations.integration.test.cjs","tests/guest-access.integration.test.cjs","tests/handoff.integration.test.cjs","tests/catalog.integration.test.cjs","tests/catalog-benchmark.cjs"];
    for(const file of files.filter(f=>!process.argv.includes("--skip-benchmark")||f!=="tests/catalog-benchmark.cjs")) {
      const result=spawnSync(process.execPath,[...(file.endsWith("catalog-benchmark.cjs")?[]:["--test"]),file,...(process.argv.includes("--catalog-baseline")?["--baseline-only"]:process.argv.includes("--catalog-indexes")?["--index-study"]:[])],{cwd:root,env,stdio:"inherit"});
      if(result.status!==0){process.exitCode=result.status??1;break;}
    }
  }finally{
    if(started)run(path.join(pg,"pg_ctl.exe"),["-D",data,"-w","stop","-m","fast"],env);
    // Keep the stopped synthetic cluster for inspection. No recursive deletion.
    console.log("Isolated PostgreSQL cluster stopped; retained at "+data);
  }
})().catch(error=>{console.error(error.message);process.exitCode=1;});
