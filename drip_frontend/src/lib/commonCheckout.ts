import { loadCheckoutAttempt } from './checkoutAttempt';
const prefix='magic-city-common-checkout-v1:';
export function commonCheckoutEnabled():boolean {
 return import.meta.env.MODE==='staging'&&import.meta.env.DEV===true&&import.meta.env.PROD===false&&
  import.meta.env.VITE_COMMON_CHECKOUT_ENABLED==='true'&&typeof window!=='undefined'&&window.location.origin==='http://127.0.0.1:5173';
}
export function prepareCommonCheckout(orderId:string):string|null {
 if(!commonCheckoutEnabled())return null;
 const a=loadCheckoutAttempt();
 if(!/^[A-Za-z0-9_-]{1,128}$/.test(orderId)||!a||a.state!=='success'||a.result?.orderId!==orderId||
  typeof a.token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(a.token)||typeof a.key!=='string')
  throw new Error('COMMON_CHECKOUT_BLOCKED');
 const entry={version:1,orderId,token:a.token,attemptKey:a.key};
 const key=prefix+orderId,old=sessionStorage.getItem(key);
 // Unmarked historical attempts never acquire a common grant on replay.
 // Existing phase C/D associations are retained without rewriting their attempt.
 if(a.checkoutMode==='historical'||(a.checkoutMode!=='common'&&!old))return null;
 if(old){const saved=JSON.parse(old);if(saved.version!==1||saved.orderId!==orderId||saved.token!==a.token||saved.attemptKey!==a.key)throw new Error('COMMON_CHECKOUT_CONFLICT');}
 else {const value=JSON.stringify(entry);sessionStorage.setItem(key,value);if(sessionStorage.getItem(key)!==value)throw new Error('COMMON_CHECKOUT_STORAGE');}
 return '/checkout/checkout-landing?orderId='+encodeURIComponent(orderId);
}
