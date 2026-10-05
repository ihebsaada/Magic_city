import {Prisma} from "@prisma/client";

export class CatalogueInputError extends Error {}
export function textQuery(value:unknown,name:string,max=128):string|undefined {
 if(value===undefined)return undefined;
 if(typeof value!=="string" || value.length>max)throw new CatalogueInputError("Invalid "+name);
 return value.trim()||undefined;
}
export function validateTextQueryKeys(query:Record<string,unknown>) {
 if(Object.keys(query).some(k=>/^(?:search|vendor)\[/.test(k)))throw new CatalogueInputError("Invalid text query");
}
export const escapeLike=(value:string)=>value.replace(/[\\%_]/g,"\\$&");
export function productSearch(search?:string):Prisma.ProductWhereInput|undefined {
 if(!search)return undefined;
 const contains=escapeLike(search);
 return {OR:[{title:{contains,mode:"insensitive"}},{vendor:{contains,mode:"insensitive"}},
  {handle:{contains,mode:"insensitive"}},{tags:{has:search}}]};
}
export const variantReadSelect={
 price:true,compareAtPrice:true,inventoryQuantity:true,reservedQuantity:true,option1:true,option2:true
} as const;
export function productReadSelect(fullImages:boolean,includeCollection=true,description=true) {
 return {
  id:true,handle:true,title:true,vendor:true,descriptionHtml:description,
  option1Name:true,option2Name:true,option3Name:true,
  images:{select:{src:true},...(fullImages?{}:{take:1}),orderBy:[{position:"asc" as const},{id:"asc" as const}]},
  variants:{select:variantReadSelect,orderBy:{id:"asc" as const}},
  collections:includeCollection?{select:{collection:{select:{handle:true}}},take:1,orderBy:{collectionId:"asc" as const}}:false,
 } satisfies Prisma.ProductSelect;
}
export function availableStock(v:{inventoryQuantity?:number|null;reservedQuantity?:number|null}):number {
 return Math.max(0,(v.inventoryQuantity??0)-(v.reservedQuantity??0));
}
// Legacy prices remain those of the first variant, now consistently ordered by ID.
export function toProductDto(p:any,collectionHandleOverride?:string) {
 const variants=p.variants??[],first=variants[0],price=first?.price!=null?Number(first.price):0;
 const compareAtPrice=first?.compareAtPrice!=null?Number(first.compareAtPrice):null;
 return {
  id:p.id,handle:p.handle,title:p.title,mainImage:p.images?.[0]?.src??"",
  images:(p.images??[]).map((i:{src:string})=>i.src),price,compareAtPrice,isNew:false,
  isOnSale:compareAtPrice!=null&&compareAtPrice>price,brand:p.vendor??"",
  description:p.descriptionHtml??"",collection:collectionHandleOverride??p.collections?.[0]?.collection?.handle??"",
  option1Name:p.option1Name??null,option2Name:p.option2Name??null,option3Name:p.option3Name??null,
  colors:[...new Set<string>(variants.map((v:any)=>v.option2).filter(Boolean))],
  sizes:[...new Set<string>(variants.map((v:any)=>v.option1).filter(Boolean))],
  stock:variants.reduce((sum:number,v:any)=>sum+availableStock(v),0),
 };
}
