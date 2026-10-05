import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { commonAccessEnabled, loadCommonOrder, preparePairing, checkPairing, readAttempt, renewPendingPairing, readOrder, pay, formatMoney, errorMessage, type Handoff, type OrderMin } from "@/lib/secureCheckout";

export default function CheckoutLanding(){
 const [params]=useSearchParams(),orderId=params.get("orderId")||"";
 const [pairing,setPairing]=useState<Handoff|null>(null),[order,setOrder]=useState<OrderMin|null>(null),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
 const common=commonAccessEnabled();
 const [revision,setRevision]=useState(0);
 const lock=useRef(false),mounted=useRef(true),current=useRef(orderId);current.current=orderId;
 useEffect(()=>{mounted.current=true;setOrder(null);setPairing(null);setMessage("");const controller=new AbortController();
  // No anonymous request and no automatic preparation/mutation on mount.
  try{if(common){setBusy(true);void loadCommonOrder(orderId,controller.signal).then(o=>{if(!controller.signal.aborted)setOrder(o);}).catch(e=>{if(!controller.signal.aborted)setMessage(errorMessage(e));}).finally(()=>{if(!controller.signal.aborted)setBusy(false);});}
  else {const a=readAttempt(orderId);setPairing(a.pairing||null);if(a.authorized)void readOrder(orderId,controller.signal).then(o=>{if(!controller.signal.aborted)setOrder(o);}).catch(e=>{if(!controller.signal.aborted)setMessage(errorMessage(e));});}}catch(e){setMessage(errorMessage(e));}
  return()=>{mounted.current=false;controller.abort();};
 },[orderId,common,revision]);
 async function run(kind:"prepare"|"check"|"pay"|"renew"){
  if(lock.current)return;lock.current=true;setBusy(true);setMessage("");
  try{
   if(kind==="renew"){const renewed=await renewPendingPairing(orderId);if(!renewed){const o=await readOrder(orderId);if(mounted.current&&current.current===orderId){setPairing(readAttempt(orderId).pairing!);setOrder(o);}return;}if(mounted.current&&current.current===orderId)setPairing(null);}
   if(kind==="prepare"||kind==="renew") {const p=await preparePairing(orderId);if(mounted.current&&current.current===orderId)setPairing(p);}
   if(kind==="check"){const p=await checkPairing(orderId);if(mounted.current)setPairing(p);if(p.state==="approved"){const o=await readOrder(orderId);if(mounted.current)setOrder(o);}else if(mounted.current)setMessage("Attendi l'autorizzazione esplicita nella scheda Store.");}
   if(kind==="pay"){const p=await pay(orderId);if(mounted.current)window.location.assign(p.url);}
  }catch(e){if(mounted.current)setMessage(errorMessage(e));}
  finally{lock.current=false;if(mounted.current)setBusy(false);}
 }
 return <div className="min-h-screen bg-background"><Navigation/><main className="max-w-xl mx-auto p-6 space-y-4"><h1 className="text-2xl font-bold">Checkout sicuro</h1>
 <p>Ordine: {orderId}</p>
 {common&&!order&&<section><p>Verifica accesso allo stesso ordine. Se i dati sono persi, torna al Store o richiedi un recupero verificato. Nessun nuovo ordine.</p><Button disabled={busy} onClick={()=>setRevision(v=>v+1)}>Ripeti verifica accesso</Button></section>}
 {!common&&!order && <section><p>Abbina questa scheda al Store. Nessun accesso è consentito con il solo numero d'ordine.</p>
 {!pairing ? <Button disabled={busy||!orderId} onClick={()=>void run("prepare")}>Prepara abbinamento</Button> : <div className="space-y-3"><p>Copia nel Store: <code>{pairing.pairingId}</code></p><p>Codice di controllo: <strong>{pairing.phrase}</strong></p><p>Nel Store confronta i codici e autorizza esplicitamente. Torna poi a questa stessa scheda.</p><Button disabled={busy} onClick={()=>void run("check")}>Verifica autorizzazione</Button>
 {pairing.state==="pending"&&Date.parse(pairing.expiresAt)<=Date.now()&&<Button disabled={busy} onClick={()=>void run("renew")}>Prepara un nuovo abbinamento scaduto</Button>}</div>}</section>}
 {order && <section><p>Totale: {formatMoney(order.total,order.currency)}</p><p>Pagamento: {order.paymentStatus}</p>{order.paymentStatus==="PENDING"&&<Button disabled={busy} onClick={()=>void run("pay")}>Paga o riprendi lo stesso pagamento</Button>}</section>}
 {busy&&<p role="status">Verifica in corso...</p>}{message&&<p role="alert">{message}</p>}
 <p className="text-sm">Conserva questa scheda durante il pagamento. Dopo un timeout riprova con lo stesso ordine. Se i dati della scheda sono persi, torna al Store per autorizzare un nuovo abbinamento; non creare un altro ordine.</p>
 </main></div>;
}
