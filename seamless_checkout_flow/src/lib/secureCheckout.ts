import {storeUrl} from "./storeNavigation";
const API=import.meta.env.VITE_PRIMARY_API_URL ?? "http://localhost:4000/api";
const KEY="drip-checkout-guest-v1";
export type Handoff={pairingId:string;orderId:string;phrase:string;expiresAt:string;state:"pending"|"approved"};
export type Attempt={orderId:string;token?:string;preparedUntil?:string;pairing?:Handoff;authorized?:boolean;sessionId?:string;sessionUrl?:string;payCalls:number;prepareCalls:number;nextRequestAt?:number};
export type OrderMin={id:string;total:number;currency:string;paymentStatus:string;status:string;createdAt?:string};
export class CheckoutError extends Error{constructor(public status:number,public code:string,public retryAfter=0){super(code);}}
function validId(id:string){if(!/^[A-Za-z0-9_-]{1,128}$/.test(id))throw new CheckoutError(401,"ORDER_ACCESS_DENIED");}
export function readAttempt(orderId:string):Attempt {
 validId(orderId);
 const raw=sessionStorage.getItem(KEY+":"+orderId);
 if(!raw)return {orderId,payCalls:0,prepareCalls:0};
 try {const a=JSON.parse(raw) as Attempt;
  if(a.orderId!==orderId || !Number.isInteger(a.payCalls) || a.payCalls<0 || !Number.isInteger(a.prepareCalls) || a.prepareCalls<0 ||
   (a.token!==undefined&&!/^[A-Za-z0-9_-]{43}$/.test(a.token)) || (a.authorized&&!a.token) ||
   (a.sessionId!==undefined&&(!/^cs_[A-Za-z0-9_]{1,250}$/.test(a.sessionId)||!a.authorized)) ||
   (a.pairing&&(a.pairing.orderId!==orderId||!/^[A-Za-z0-9_-]{32}$/.test(a.pairing.pairingId))))throw new Error();
  return a;
 }catch{throw new CheckoutError(401,"CHECKOUT_STORAGE_INVALID");}
}
function save(a:Attempt){const key=KEY+":"+a.orderId,value=JSON.stringify(a);sessionStorage.setItem(key,value);if(sessionStorage.getItem(key)!==value)throw new CheckoutError(503,"CHECKOUT_STORAGE_UNAVAILABLE");}
export function credential(orderId:string):Attempt{const a=readAttempt(orderId);if(!a.authorized||!a.token)throw new CheckoutError(401,"ORDER_ACCESS_DENIED");return a;}
async function request<T>(path:string,a:Attempt,body?:unknown,signal?:AbortSignal):Promise<T>{
 if(a.nextRequestAt && a.nextRequestAt>Date.now())throw new CheckoutError(429,"WAIT_RETRY",Math.ceil((a.nextRequestAt-Date.now())/1000));
 const controller=new AbortController(),abort=()=>controller.abort();if(signal?.aborted)abort();else signal?.addEventListener("abort",abort,{once:true});
 const timer=setTimeout(abort,15000);
 try {const r=await fetch(API+path,{method:body===undefined?"GET":"POST",body:body===undefined?undefined:JSON.stringify(body),headers:{"Content-Type":"application/json",...(a.token?{"Order-Access-Token":a.token}:{})},cache:"no-store",referrerPolicy:"no-referrer",signal:controller.signal});
 const data=await r.json().catch(()=>null);
 if(!r.ok){const code=typeof data?.error==="string"&&/^[A-Z][A-Z0-9_]{0,79}$/.test(data.error)?data.error:"CHECKOUT_RETRY";const seconds=Math.min(3600,Math.max(1,Number(r.headers.get("Retry-After"))||60));
 if(r.status===429){const current=readAttempt(a.orderId);current.nextRequestAt=Date.now()+seconds*1000;save(current);}throw new CheckoutError(r.status,code,r.status===429?seconds:0);}
 return data as T;
 }finally{clearTimeout(timer);signal?.removeEventListener("abort",abort);}
}
const inFlight=new Map<string,Promise<unknown>>();
function single<T>(key:string,run:()=>Promise<T>):Promise<T>{const previous=inFlight.get(key);if(previous)return previous as Promise<T>;const p=run().finally(()=>inFlight.delete(key));inFlight.set(key,p);return p;}
export function preparePairing(orderId:string):Promise<Handoff>{
 return single("pair:"+orderId,async()=>{
  const a=readAttempt(orderId);
  // Persist storage availability before any network operation.
  save(a);
  if(!a.token){if(a.prepareCalls>=3)throw new CheckoutError(503,"CHECKOUT_ASSISTANCE");a.prepareCalls++;save(a);
   const p=await request<{accessToken:string;expiresAt:string}>("/order-access/prepare",a,{});
   if(!/^[A-Za-z0-9_-]{43}$/.test(p.accessToken)||!Number.isFinite(Date.parse(p.expiresAt)))throw new CheckoutError(503,"CHECKOUT_RETRY");
   a.token=p.accessToken;a.preparedUntil=p.expiresAt;save(a);
  }
  if(a.pairing)return a.pairing;
  const p=await request<Handoff>("/order-handoffs",a,{orderId});
  if(p.orderId!==orderId||!/^[A-Za-z0-9_-]{32}$/.test(p.pairingId)||!/^[a-f0-9]{4}(?:-[a-f0-9]{4}){2}$/.test(p.phrase))throw new CheckoutError(503,"CHECKOUT_RETRY");
  a.pairing=p;save(a);return p;
 });
}
export function checkPairing(orderId:string):Promise<Handoff>{
 return single("redeem:"+orderId,async()=>{
  const a=readAttempt(orderId);if(!a.token||!a.pairing)throw new CheckoutError(401,"ORDER_ACCESS_DENIED");
  const p=await request<Handoff>("/order-handoffs/"+a.pairing.pairingId+"/redeem",a,{});
  if(p.orderId!==orderId||p.pairingId!==a.pairing.pairingId||p.phrase!==a.pairing.phrase||!["pending","approved"].includes(p.state))throw new CheckoutError(401,"ORDER_ACCESS_DENIED");
  if(a.authorized&&p.state!=="approved")throw new CheckoutError(409,"HANDOFF_CONFLICT");
  a.pairing=p;a.authorized=p.state==="approved";save(a);return p;
 });
}
// Explicit renewal of an expired PENDING pairing only; no order/payment reset.
export async function renewPendingPairing(orderId:string):Promise<boolean>{
 const a=readAttempt(orderId);if(a.authorized||a.sessionId||!a.pairing||Date.parse(a.pairing.expiresAt)>Date.now())throw new CheckoutError(409,"HANDOFF_CONFLICT");
 try {
  const p=await checkPairing(orderId);
  if(p.state==="approved")return false;
  throw new CheckoutError(409,"HANDOFF_CONFLICT");
 }catch(e){
  // Local expiry is not proof: an approval response may have been lost.
  if(!(e instanceof CheckoutError)||e.status!==410||e.code!=="HANDOFF_EXPIRED")throw e;
 }
 const current=readAttempt(orderId);
 if(current.token!==a.token||current.authorized||current.sessionId)throw new CheckoutError(409,"HANDOFF_CONFLICT");
 save({...current,token:undefined,pairing:undefined,preparedUntil:undefined});
 return true;
}
export async function readOrder(orderId:string,signal?:AbortSignal){const a=credential(orderId);const o=await request<OrderMin>("/orders/"+encodeURIComponent(orderId)+"/min",a,undefined,signal);if(o.id!==orderId||o.currency!=="EUR"||!Number.isFinite(o.total)||o.total<0)throw new CheckoutError(409,"ORDER_MISMATCH");return o;}
// Local simulation is launcher-configured development only, never a production build.
export function validatePaymentURL(value:string):URL {
  let u:URL;
  try { u=new URL(value); } catch { throw new CheckoutError(409,"PAYMENT_SESSION_INVALID"); }
  const stripe=u.origin==="https://checkout.stripe.com";
  const local=import.meta.env.MODE==="staging" && import.meta.env.DEV===true &&
    import.meta.env.PROD===false && import.meta.env.VITE_LOCAL_STRIPE_ORIGIN==="http://127.0.0.1:4101" &&
    typeof window!=="undefined" && (window.location.origin==="http://127.0.0.1:5174" || commonAccessEnabled()) &&
    u.origin==="http://127.0.0.1:4101";
  if((!stripe&&!local)||u.username||u.password||u.hash)
    throw new CheckoutError(409,"PAYMENT_SESSION_INVALID");
  return u;
}
export function pay(orderId:string):Promise<{url:string;sessionId:string}>{
 return single("pay:"+orderId,async()=>{
  if(commonAccessEnabled())await loadCommonOrder(orderId);
  const a=credential(orderId);
  if(a.payCalls>=4)throw new CheckoutError(503,"CHECKOUT_ASSISTANCE");
  a.payCalls++;save(a);
  // Always reconcile with the backend; an old URL may have expired or been paid.
  const p=await request<{url:string;sessionId:string}>("/pay",a,{orderId});
  validatePaymentURL(p.url);if(!/^cs_[A-Za-z0-9_]{1,250}$/.test(p.sessionId))throw new CheckoutError(409,"PAYMENT_SESSION_INVALID");
  // A new generation requires server resolution; never silently replace a known session.
  if(a.sessionId && a.sessionId!==p.sessionId)throw new CheckoutError(409,"PAYMENT_SESSION_CHANGED");
  if(commonAccessEnabled()){
   const current=credential(orderId),url=validatePaymentURL(p.url);
   if(current.token!==a.token||current.sessionId!==a.sessionId)throw new CheckoutError(409,"PAYMENT_SESSION_CHANGED");
   if(url.origin==="http://127.0.0.1:4101"&&url.pathname!=="/session/"+p.sessionId)throw new CheckoutError(409,"PAYMENT_SESSION_INVALID");
  }
  a.sessionId=p.sessionId;a.sessionUrl=p.url;save(a);return p;
 });
}
export async function confirm(orderId:string,sessionId:string,signal?:AbortSignal){
 const a=credential(orderId);
 if(!a.sessionId||a.sessionId!==sessionId)throw new CheckoutError(409,"PAYMENT_SESSION_MISMATCH");
 const result=await request<{paid:boolean;orderId?:string;order?:{id:string}}>("/pay/confirm?session_id="+encodeURIComponent(sessionId),a,undefined,signal);
 if(typeof result.paid!=="boolean" || (result.orderId!==undefined&&result.orderId!==orderId)||(result.order!==undefined&&result.order.id!==orderId))throw new CheckoutError(409,"ORDER_MISMATCH");
 return result;
}
export function formatMoney(total:number,currency="EUR"){if(currency!=="EUR"||!Number.isFinite(total)||total<0)throw new CheckoutError(409,"ORDER_MISMATCH");return new Intl.NumberFormat("it-IT",{style:"currency",currency:"EUR"}).format(total);}
export function errorMessage(e:unknown){
 if(e instanceof CheckoutError){
  if(e.status===401)return "Accesso non disponibile. Riprendi l'abbinamento dal Store; se hai perso i dati, serve un recupero verificato (email non configurata).";
  if(e.status===409)return "Ordine o sessione da verificare. Non creare un nuovo ordine. Richiedi assistenza.";
  if(e.status===410)return "Abbinamento o ordine scaduto. Verifica lo stato prima di proseguire.";
  if(e.status===429)return "Attendi "+e.retryAfter+" secondi prima di riprovare.";
 }
 return "Connessione o verifica non disponibile. Riprova esplicitamente sullo stesso ordine; nessun nuovo ordine viene creato.";
}

export function storeCartUrl(){return storeUrl("/cart");}

export function commonAccessEnabled():boolean {
 return import.meta.env.MODE==="staging"&&import.meta.env.DEV===true&&import.meta.env.PROD===false&&
 import.meta.env.VITE_COMMON_CHECKOUT_ENABLED==="true"&&import.meta.env.VITE_ROUTER_BASENAME==="/checkout/"&&
 typeof window!=="undefined"&&window.location.origin==="http://127.0.0.1:5173";
}
export async function loadCommonOrder(orderId:string,signal?:AbortSignal):Promise<OrderMin>{
 if(!commonAccessEnabled())throw new CheckoutError(401,"ORDER_ACCESS_DENIED");
 validId(orderId);
 const raw=sessionStorage.getItem("magic-city-common-checkout-v1:"+orderId);
 if(!raw)throw new CheckoutError(401,"ORDER_ACCESS_DENIED");
 let grant:{version:number;orderId:string;token:string;attemptKey:string};
 try{grant=JSON.parse(raw);}catch{throw new CheckoutError(401,"ORDER_ACCESS_DENIED");}
 if(!grant||grant.version!==1||grant.orderId!==orderId||typeof grant.token!=="string"||typeof grant.attemptKey!=="string"||!/^[A-Za-z0-9_-]{43}$/.test(grant.token)||!/^[A-Za-z0-9_-]{16,128}$/.test(grant.attemptKey))throw new CheckoutError(401,"ORDER_ACCESS_DENIED");
 const a=readAttempt(orderId);
 if(a.token&&a.token!==grant.token)throw new CheckoutError(409,"COMMON_ACCESS_CONFLICT");
 const order=await request<OrderMin>("/orders/"+encodeURIComponent(orderId)+"/min",{...a,token:grant.token},undefined,signal);
 if(signal?.aborted)throw new DOMException("Aborted","AbortError");
 if(order.id!==orderId||order.currency!=="EUR"||!Number.isFinite(order.total)||order.total<0)throw new CheckoutError(409,"ORDER_RESPONSE_INVALID");
 if(sessionStorage.getItem("magic-city-common-checkout-v1:"+orderId)!==raw)throw new CheckoutError(409,"COMMON_ACCESS_CONFLICT");
 const current=readAttempt(orderId);
 if((current.token&&current.token!==grant.token)||current.sessionId!==a.sessionId)throw new CheckoutError(409,"COMMON_ACCESS_CONFLICT");
 save({...current,token:grant.token,authorized:true});return order;
}
