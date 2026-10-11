import {checkoutLink} from './handoffLink';
import {apiPost} from '@/services/api';
import {orderAccessToken} from './checkoutAttempt';
export function automaticHandoffEnabled(){return import.meta.env.VITE_AUTOMATIC_HANDOFF === 'true';}
export class AutomaticHandoff {
 private recipient: Window;
 private orderId = '';
 private nonce = crypto.randomUUID();
 private recipientNonce = '';
 private pairingId = '';
 private busy = false;
 private approved = false;
 private stop?:()=>void;
 constructor(){const recipient=window.open('about:blank','_blank');if(!recipient)throw new Error('CHECKOUT_WINDOW_BLOCKED');this.recipient=recipient;}
 cancel(){if(!this.orderId)this.recipient.close();this.stop?.();}
 start(orderId:string):Promise<void>{
  const url=new URL(checkoutLink(orderId));const token=orderAccessToken(orderId);
  if(!token)throw new Error('ORDER_ACCESS_REQUIRED');this.orderId=orderId;
  return new Promise((resolve,reject)=>{
   let ended=false;
   const finish=(error?:Error)=>{if(ended)return;ended=true;clearInterval(timer);clearTimeout(deadline);window.removeEventListener('message',receive);if(error)reject(error);else resolve();};
   const send=(type:string)=>{if(!ended&&!this.recipient.closed)this.recipient.postMessage({version:1,type,orderId:this.orderId,nonce:this.nonce,recipientNonce:this.recipientNonce},url.origin);};
   const receive=(event:MessageEvent)=>{
    const m=event.data;if(ended||event.origin!==url.origin||event.source!==this.recipient||!m||Array.isArray(m)||m.version!==1||m.orderId!==orderId||m.nonce!==this.nonce)return;
    if(m.type==='ready'&&m.recipientNonce===this.recipientNonce&&this.pairingId&&this.approved){send('done');finish();return;}
    if(m.type!=='pairing'||typeof m.recipientNonce!=='string'||!/^[A-Za-z0-9_-]{16,128}$/.test(m.recipientNonce)||typeof m.pairingId!=='string'||!/^[A-Za-z0-9_-]{32}$/.test(m.pairingId)||typeof m.phrase!=='string'||!/^[a-f0-9]{4}(?:-[a-f0-9]{4}){2}$/.test(m.phrase))return;
    if((this.recipientNonce&&this.recipientNonce!==m.recipientNonce)||(this.pairingId&&this.pairingId!==m.pairingId))return;
    this.recipientNonce=m.recipientNonce;this.pairingId=m.pairingId;if(this.busy)return;this.busy=true;
    void (async()=>{try{
     const base='/orders/'+encodeURIComponent(orderId)+'/handoffs/'+m.pairingId;
     const options={headers:{'Order-Access-Token':token},cache:'no-store' as const,timeoutMs:15000};
     const p=await apiPost<{orderId:string;pairingId:string;phrase:string}>(base+'/inspect',{},options);
     if(ended)return;if(p.orderId!==orderId||p.pairingId!==m.pairingId||p.phrase!==m.phrase)throw Error('HANDOFF_CONFLICT');
     const a=await apiPost<{orderId:string;pairingId:string;phrase:string;state:string}>(base+'/approve',{},options);
     if(ended)return;if(a.orderId!==orderId||a.pairingId!==m.pairingId||a.phrase!==m.phrase||a.state!=='approved')throw Error('HANDOFF_CONFLICT');this.approved=true;send('approved');
    }catch{finish(Error('CHECKOUT_TRANSFER_UNAVAILABLE'));}finally{this.busy=false;}})();
   };
   window.addEventListener('message',receive);
   const timer=setInterval(()=>{if(this.recipient.closed){finish(Error('CHECKOUT_WINDOW_CLOSED'));return;}send('challenge');},500);
   const deadline=setTimeout(()=>finish(Error('CHECKOUT_TRANSFER_TIMEOUT')),60000);
   this.stop=()=>finish(Error('CHECKOUT_TRANSFER_CANCELLED'));
   this.recipient.location.href=url.href;send('challenge');
  });
 }
}
