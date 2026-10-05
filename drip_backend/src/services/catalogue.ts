import {Prisma} from "@prisma/client";
import prisma from "../prisma";
import {CatalogueInputError,textQuery,escapeLike,productReadSelect,variantReadSelect,toProductDto,availableStock} from "./productRead";

function integer(value:unknown,fallback:number,max:number,name:string) {
 if(value===undefined)return fallback;
 if(typeof value!=="string" || !/^[1-9][0-9]*$/.test(value) || Number(value)>max)
  throw new CatalogueInputError("Invalid "+name);
 return Number(value);
}
function boolean(value:unknown,name:string) {
 if(value===undefined)return undefined;
 if(value!=="true"&&value!=="false")throw new CatalogueInputError("Invalid "+name);
 return value==="true";
}
function price(value:unknown,name:string) {
 if(value===undefined)return undefined;
 if(typeof value!=="string"||! /^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,2})?$/.test(value)||Number(value)>99999999.99)
  throw new CatalogueInputError("Invalid "+name);
 return Number(value);
}
export function catalogueQuery(query:Record<string,unknown>) {
 if(Object.keys(query).some(k=>k.includes("[")))throw new CatalogueInputError("Invalid query");
 const sort=textQuery(query.sort,"sort")??"featured";
 const sorts:Record<string,string>={
  featured:'p."id" ASC',"id-asc":'p."id" ASC',"id-desc":'p."id" DESC',
  name:'p."title" ASC,p."id" ASC',"name-desc":'p."title" DESC,p."id" ASC',
  "price-asc":'COALESCE(v."price",0) ASC,p."id" ASC',"price-desc":'COALESCE(v."price",0) DESC,p."id" ASC'
 };
 if(!Object.prototype.hasOwnProperty.call(sorts,sort))throw new CatalogueInputError("Invalid sort");
 const minPrice=price(query.minPrice,"minPrice"),maxPrice=price(query.maxPrice,"maxPrice");
 if(minPrice!==undefined&&maxPrice!==undefined&&minPrice>maxPrice)throw new CatalogueInputError("Invalid price range");
 return {page:integer(query.page,1,1000000,"page"),pageSize:integer(query.pageSize,24,100,"pageSize"),
  search:textQuery(query.search,"search"),vendor:textQuery(query.vendor,"vendor"),
  collection:textQuery(query.collection,"collection"),size:textQuery(query.size,"size"),color:textQuery(query.color,"color"),
  inStock:boolean(query.inStock,"inStock"),sale:boolean(query.sale,"sale"),minPrice,maxPrice,sort,order:sorts[sort]};
}
export async function readCatalogue(query:Record<string,unknown>) {
 const q=catalogueQuery(query),params:unknown[]=[],parts:string[]=[];
 const bind=(value:unknown)=>{params.push(value);return "$"+params.length;};
 if(q.search){
  const pattern=bind("%"+escapeLike(q.search)+"%"),tag=bind(q.search);
  parts.push('(p."title" ILIKE '+pattern+' OR p."vendor" ILIKE '+pattern+' OR p."handle" ILIKE '+pattern+' OR '+tag+'=ANY(p."tags"))');
 }
 if(q.vendor)parts.push('p."vendor"='+bind(q.vendor));
 if(q.collection)parts.push('EXISTS(SELECT 1 FROM "ProductCollection" pc JOIN "Collection" c ON c."id"=pc."collectionId" WHERE pc."productId"=p."id" AND c."handle"='+bind(q.collection)+')');
 const variantParts=['s."productId"=p."id"'];
 if(q.size)variantParts.push('s."option1"='+bind(q.size));
 if(q.color)variantParts.push('s."option2"='+bind(q.color));
 if(q.size||q.color)parts.push('EXISTS(SELECT 1 FROM "Variant" s WHERE '+variantParts.join(" AND ")+')');
 if(q.inStock!==undefined)parts.push((q.inStock?"":"NOT ")+'EXISTS(SELECT 1 FROM "Variant" s WHERE '+variantParts.join(" AND ")+' AND s."inventoryQuantity">s."reservedQuantity")');
 if(q.minPrice!==undefined)parts.push('COALESCE(v."price",0)>='+bind(q.minPrice)+'::numeric');
 if(q.maxPrice!==undefined)parts.push('COALESCE(v."price",0)<='+bind(q.maxPrice)+'::numeric');
 if(q.sale!==undefined)parts.push(q.sale?'v."compareAtPrice">COALESCE(v."price",0)':'NOT COALESCE(v."compareAtPrice">COALESCE(v."price",0),false)');
 const join=' LEFT JOIN LATERAL(SELECT "price","compareAtPrice" FROM "Variant" WHERE "productId"=p."id" ORDER BY "id" LIMIT 1)v ON true';
 const priceFilter=q.minPrice!==undefined||q.maxPrice!==undefined||q.sale!==undefined;
 const where=parts.length?" WHERE "+parts.join(" AND "):"";
 const skip=(q.page-1)*q.pageSize;
 return prisma.$transaction(async tx=>{
  const count=await tx.$queryRawUnsafe<Array<{total:bigint}>>('SELECT COUNT(*) AS total FROM "Product" p'+(priceFilter?join:"")+where,...params);
  const total=Number(count[0].total);
  if(skip>=total)return {items:[],pagination:{page:q.page,pageSize:q.pageSize,total,totalPages:Math.ceil(total/q.pageSize),hasNext:false}};
  // SQL fragments/order are fixed above; all external values are bound parameters.
  const ids=await tx.$queryRawUnsafe<Array<{id:number}>>('SELECT p."id" FROM "Product" p'+(priceFilter||q.sort.startsWith("price-")?join:"")+where+' ORDER BY '+q.order+' LIMIT $'+(params.length+1)+' OFFSET $'+(params.length+2),...params,q.pageSize,skip);
  const rows=await tx.product.findMany({where:{id:{in:ids.map(x=>x.id)}},select:{
   ...productReadSelect(false,true,false),variants:{select:{...variantReadSelect,id:true,sku:true,option3:true},orderBy:{id:"asc"}}
  }});
  const byId=new Map(rows.map(p=>[p.id,p]));
  const items=ids.map(({id})=>{
   const p=byId.get(id)!;
   const {description,...card}=toProductDto(p);
   return {...card,variants:p.variants.map(v=>({id:v.id,sku:v.sku,price:v.price!=null?Number(v.price):0,
    compareAtPrice:v.compareAtPrice!=null?Number(v.compareAtPrice):null,
    option1:v.option1,option2:v.option2,option3:v.option3,stock:availableStock(v)}))};
  });
  return {items,pagination:{page:q.page,pageSize:q.pageSize,total,totalPages:Math.ceil(total/q.pageSize),hasNext:skip+items.length<total}};
 },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead,maxWait:5000,timeout:10000});
}
