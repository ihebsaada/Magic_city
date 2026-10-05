import {preparePairing,checkPairing,readOrder,type OrderMin} from './secureCheckout';
import {storeUrl} from './storeNavigation';
export function automaticHandoffEnabled(){return import.meta.env.VITE_AUTOMATIC_HANDOFF === 'true';}
export function receiveAutomaticHandoff(orderId:string,signal:AbortSignal):Promise<OrderMin>{
 const key='drip-checkout-channel-v1:'+orderId;
 const source=window.opener as Window|null,origin=new URL(storeUrl('/')).origin;
 if(!source) return Promise.reject(Error('CHECKOUT_ACCESS_REQUIRED'));
 return new Promise((resolve,reject)=>{
  let recipientNonce=crypto.randomUUID(),nonce='',busy=false,ended=false;
  const previous=sessionStorage.getItem(key);
  if(previous){try{const saved=JSON.parse(previous);if(saved.orderId!==orderId||saved.origin!==origin||typeof saved.nonce!=='string'||typeof saved.recipientNonce!=='string'||!/^[A-Za-z0-9_-]{16,128}$/.test(saved.nonce)||!/^[A-Za-z0-9_-]{16,128}$/.test(saved.recipientNonce)||!Number.isFinite(saved.expiresAt)||saved.expiresAt<=Date.now())throw Error('CHECKOUT_CHANNEL_EXPIRED');nonce=saved.nonce;recipientNonce=saved.recipientNonce;}catch{reject(Error('CHECKOUT_CHANNEL_INVALID'));return;}}
  const expiresAt=previous?JSON.parse(previous).expiresAt:Date.now()+60000;
  let verified:OrderMin|undefined;
  let pairing:Awaited<ReturnType<typeof preparePairing>>|undefined;
  const send=(type:string)=>source.postMessage({version:1,type,orderId,nonce,recipientNonce,...(type==='pairing'&&pairing?{pairingId:pairing.pairingId,phrase:pairing.phrase}:{})},origin);
  const finish=(error?:Error,order?:OrderMin)=>{if(ended)return;ended=true;clearTimeout(deadline);clearInterval(replay);window.removeEventListener('message',receive);signal.removeEventListener('abort',abort);if(error)reject(error);else resolve(order!);};
  const abort=()=>finish(new DOMException('Aborted','AbortError'));
  const receive=(event:MessageEvent)=>{
   const m=event.data;if(ended||event.source!==source||event.origin!==origin||!m||Array.isArray(m)||m.version!==1||m.orderId!==orderId||typeof m.nonce!=='string'||!/^[A-Za-z0-9_-]{16,128}$/.test(m.nonce)||(nonce&&nonce!==m.nonce))return;
   if(m.type==='done'&&verified&&m.recipientNonce===recipientNonce){try{sessionStorage.removeItem(key);}catch{/* Auxiliary nonce only; guest credentials remain. */}finish(undefined,verified);window.opener=null;return;}
   if(m.type!=='challenge'&&m.type!=='approved')return;
   if(verified){send('ready');return;}
   if(m.type==='approved'&&(!nonce||m.recipientNonce!==recipientNonce||!pairing))return;
   nonce=m.nonce;
   if(!previous){const raw=JSON.stringify({orderId,origin,nonce,recipientNonce,expiresAt});try{sessionStorage.setItem(key,raw);if(sessionStorage.getItem(key)!==raw)throw Error();}catch{finish(Error('CHECKOUT_STORAGE_UNAVAILABLE'));return;}}
   if(busy)return;busy=true;
   void (async()=>{try{
    if(m.type==='challenge'){pairing=await preparePairing(orderId);if(!ended)send('pairing');}
    else {const p=await checkPairing(orderId);if(p.state!=='approved')throw Error('CHECKOUT_ACCESS_REQUIRED');const order=await readOrder(orderId,signal);if(ended)return;verified=order;send('ready');}
   }catch{finish(Error('CHECKOUT_TRANSFER_UNAVAILABLE'));}finally{busy=false;}})();
  };
  const replay=setInterval(()=>{if(verified&&!ended)send('ready');},500);
  const deadline=setTimeout(()=>finish(Error('CHECKOUT_TRANSFER_TIMEOUT')),Math.max(1,expiresAt-Date.now()));
  window.addEventListener('message',receive);signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();
 });
}
