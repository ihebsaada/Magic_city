
const assert=require("node:assert/strict");
async function seed(db){
 const u=new URL(process.env.DATABASE_URL);assert.equal(u.hostname,"127.0.0.1");assert.equal(u.username,"lot4_test");assert.equal(u.pathname,"/lot4_isolated");
 if(await db.product.count({where:{handle:{startsWith:"perf-"}}}))return;
 await db.$executeRawUnsafe(`INSERT INTO "Product" ("handle","title","vendor","descriptionHtml","tags","option1Name","option2Name","updatedAt")
 SELECT 'perf-'||lpad(i::text,4,'0'),'Synthetic Item '||lpad(i::text,4,'0')||CASE WHEN i=2999 THEN ' RareNeedle' ELSE '' END,
 'Brand'||lpad((i%20)::text,2,'0'),repeat('<p>Synthetic description for performance.</p>',96),
 ARRAY['Tag'||(i%10)::text,'synthetic'],'Size','Color',CURRENT_TIMESTAMP FROM generate_series(1,3000)i`);
 await db.$executeRawUnsafe(`INSERT INTO "Collection" ("handle","title","description")
 SELECT 'perf-group-'||i::text,'Synthetic group '||i::text,repeat('Synthetic collection description. ',32) FROM generate_series(0,29)i`);
 await db.collection.create({data:{handle:"perf-all",title:"Synthetic entire catalogue",description:"Synthetic"}});
 await db.$executeRawUnsafe(`INSERT INTO "ProductImage" ("productId","src","alt","position")
 SELECT p."id",'https://images.example.invalid/'||p."handle"||'/'||n||'.jpg',repeat('Synthetic image alt. ',12),n
 FROM "Product" p CROSS JOIN generate_series(1,6)n WHERE p."handle" LIKE 'perf-%'`);
 await db.$executeRawUnsafe(`INSERT INTO "Variant" ("productId","sku","price","compareAtPrice","inventoryQuantity","reservedQuantity","option1","option2")
 SELECT p."id",p."handle"||'-'||n,(10+(right(p."handle",4)::int%200)/10.0+n/2.0)::numeric(10,2),
 CASE WHEN n=1 THEN 40 ELSE NULL END,CASE WHEN n=8 THEN NULL WHEN n=7 THEN 0 WHEN n=6 THEN 999 ELSE 10 END,
 CASE WHEN n=3 THEN 2 ELSE 0 END,'Size'||n,CASE WHEN n%2=0 THEN 'Blue' ELSE 'Red' END
 FROM "Product" p CROSS JOIN generate_series(1,8)n WHERE p."handle" LIKE 'perf-%'`);
 await db.$executeRawUnsafe(`INSERT INTO "ProductCollection" ("productId","collectionId")
 SELECT p."id",c."id" FROM "Product" p JOIN "Collection" c ON c."handle"='perf-all' OR c."handle"='perf-group-'||(right(p."handle",4)::int%30)::text
 WHERE p."handle" LIKE 'perf-%'`);
 await db.$executeRawUnsafe('ANALYZE');
}
module.exports={seed};
