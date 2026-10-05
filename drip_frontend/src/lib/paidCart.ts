import type {CartItem} from '@/contexts/CartContext';
const cartFingerprint=(items:CartItem[])=>JSON.stringify(items.map(i=>[i.product.id,i.selectedSize||null,i.selectedColor||null,i.quantity]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));
export const CART_REVISION='magic-city-cart-revision';
let unsafe=false;
export function markCartEdit(){try{const revision=crypto.randomUUID();localStorage.setItem(CART_REVISION,revision);if(localStorage.getItem(CART_REVISION)!==revision)unsafe=true;}catch{unsafe=true;}}
const KEY='magic-city-paid-cart-v1:';
export function rememberPaidCart(orderId:string,items:CartItem[],revision:string){
 const value=JSON.stringify({fingerprint:cartFingerprint(items),revision}),old=localStorage.getItem(KEY+orderId);
 if(old&&old!==value)throw new Error('CART_SNAPSHOT_CONFLICT');
 localStorage.setItem(KEY+orderId,value);
 if(localStorage.getItem(KEY+orderId)!==value)throw new Error('CART_STORAGE_UNAVAILABLE');
}
export function mayClearPaidCart(orderId:string,items:CartItem[]):boolean{
 if(unsafe)return false;
 try{const saved=JSON.parse(localStorage.getItem(KEY+orderId)||'null');
 return !!saved&&typeof saved.revision==='string'&&saved.revision===(localStorage.getItem(CART_REVISION)||'initial')&&saved.fingerprint===cartFingerprint(items);
 }catch{return false;}
}

export function cartRevision(){if(unsafe)return undefined;try{return localStorage.getItem(CART_REVISION)||"initial";}catch{return undefined;}}
