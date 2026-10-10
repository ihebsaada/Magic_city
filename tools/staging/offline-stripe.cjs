// Deterministic in-memory provider, injected ONLY by local tests. No sockets/SDK HTTP.
const {createHash}=require('node:crypto');
const canonical=v=>v&&typeof v==='object'?Array.isArray(v)?v.map(canonical):Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
module.exports=function offlineStripe(RealStripe,{now=1700000000000}={}){
 const signer=new RealStripe('sk_test_synthetic_only'),sessions=new Map(),keys=new Map();
 let sequence=0,fault=null;
 const copy=v=>structuredClone(v),digest=v=>createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex');
 const get=id=>{if(!sessions.has(id))throw Error('SIM_SESSION_UNKNOWN');return sessions.get(id);};
 class StripeSimulator{
  constructor(){this.webhooks=signer.webhooks;this.checkout={sessions:{
   create:async(p,o)=>{
    if(!o?.idempotencyKey)throw Error('SIM_IDEMPOTENCY_REQUIRED');
    if(fault==='before'){fault=null;throw Error('SIM_LOST_BEFORE');}
    const fingerprint=digest(p),existing=keys.get(o.idempotencyKey);
    if(existing&&existing.fingerprint!==fingerprint)throw Error('SIM_IDEMPOTENCY_CONFLICT');
    let s=existing?get(existing.id):null;
    if(!s){
     const amount=p.line_items?.[0]?.price_data?.unit_amount;
     if(p.mode!=='payment'||p.line_items.length!==1||p.line_items[0].quantity!==1||!Number.isSafeInteger(amount)||amount<50||p.line_items[0].price_data.currency!=='eur')throw Error('SIM_AMOUNT_INVALID');
     const id='cs_test_'+digest(o.idempotencyKey).slice(0,32);
     s={id,livemode:false,mode:'payment',status:'open',payment_status:'unpaid',amount_total:amount,currency:'eur',metadata:copy(p.metadata),url:'https://checkout.stripe.com/c/pay/'+id+'#synthetic',created:Math.floor(now/1000)};
     sessions.set(id,s);keys.set(o.idempotencyKey,{id,fingerprint});
    }
    if(fault==='after'){fault=null;throw Error('SIM_LOST_AFTER');}return copy(s);
   },
   retrieve:async id=>copy(get(id)),
   expire:async id=>{const s=get(id);if(s.payment_status==='paid')throw Error('SIM_ALREADY_PAID');s.status='expired';return copy(s);}
  }};}
 }
 return {StripeSimulator,count:()=>sessions.size,setFault:v=>{if(!['before','after'].includes(v))throw Error('SIM_FAULT_INVALID');fault=v;},
  complete:id=>{const s=get(id);if(s.status==='expired')throw Error('SIM_EXPIRED');s.status='complete';s.payment_status='paid';return copy(s);},
  // Signed bytes/time reproducible; integration tests inject their current clock explicitly.
  event:(id,type,secret)=>{const session=copy(get(id)),event={id:'evt_synthetic_'+(++sequence),type,livemode:false,data:{object:session}};
   const raw=Buffer.from(JSON.stringify(event)),timestamp=Math.floor(now/1000);
   return {event,raw,signature:signer.webhooks.generateTestHeaderString({payload:raw.toString(),secret,timestamp}),receivedAt:now};},
  verify:(delivery,secret)=>signer.webhooks.constructEvent(delivery.raw,delivery.signature,secret,300,undefined,delivery.receivedAt)};
};
