import {loadCheckoutAttempt} from './checkoutAttempt';
import {checkoutLink} from './handoffLink';
import {apiPost} from '@/services/api';
export function navigationEnabled(){return import.meta.env.MODE==='staging'&&import.meta.env.VITE_NAVIGATION_HANDOFF_ENABLED==='true';}
export function shippingEstimate(subtotal:number){return navigationEnabled()&&Math.round(subtotal*100)<20000?5:0;}
const running=new Map<string,Promise<void>>();
export function navigateToCheckout(orderId:string,signal?:AbortSignal):Promise<void>{
 const old=running.get(orderId);if(old)return old;
 const promise=(async()=>{
  signal?.throwIfAborted();
  const a=loadCheckoutAttempt();if(!navigationEnabled()||a?.result?.orderId!==orderId||!a.token||a.state!=='success')throw new Error('ORDER_ACCESS_DENIED');
  const destination=checkoutLink(orderId),key='magic-city-navigation-v1:'+orderId;
  let creationKey=sessionStorage.getItem(key);if(!creationKey){creationKey=crypto.randomUUID();sessionStorage.setItem(key,creationKey);}
  if(!/^[A-Za-z0-9_-]{16,128}$/.test(creationKey)||sessionStorage.getItem(key)!==creationKey)throw new Error('CHECKOUT_STORAGE_INVALID');
  const p=await apiPost<{orderId:string;ticket:string;expiresAt:string}>('/orders/'+encodeURIComponent(orderId)+'/navigation-handoffs',{}, {headers:{'Order-Access-Token':a.token,'Idempotency-Key':creationKey},signal,cache:"no-store",timeoutMs:15000});
  if(p.orderId!==orderId||!/^[A-Za-z0-9_-]{43}$/.test(p.ticket)||!Number.isFinite(Date.parse(p.expiresAt))||Date.parse(p.expiresAt)<=Date.now())throw new Error('ORDER_ACCESS_DENIED');
  signal?.throwIfAborted();
  const current=loadCheckoutAttempt();if(current?.token!==a.token||current?.result?.orderId!==orderId||sessionStorage.getItem(key)!==creationKey)throw new Error('CHECKOUT_STORAGE_INVALID');
  window.location.assign(destination+'#navigation='+p.ticket);
 })().finally(()=>running.delete(orderId));running.set(orderId,promise);return promise;
}
