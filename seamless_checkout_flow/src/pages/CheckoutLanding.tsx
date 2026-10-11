import {Shield,Lock,CreditCard} from "lucide-react";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { navigationEnabled, loadNavigationOrder, commonAccessEnabled, loadCommonOrder, preparePairing, checkPairing, readAttempt, renewPendingPairing, readOrder, pay, formatMoney, errorMessage, type Handoff, type OrderMin } from "@/lib/secureCheckout";

export default function CheckoutLanding(){
 const [params]=useSearchParams(),orderId=params.get("orderId")||"";
 const [pairing,setPairing]=useState<Handoff|null>(null),[order,setOrder]=useState<OrderMin|null>(null),[message,setMessage]=useState(""),[busy,setBusy]=useState(true);
 const common=commonAccessEnabled();
 const automatic=navigationEnabled();
 const [revision,setRevision]=useState(0);
 const lock=useRef(false),mounted=useRef(true),current=useRef(orderId);current.current=orderId;
 useEffect(()=>{mounted.current=true;setOrder(null);setPairing(null);setMessage("");const controller=new AbortController();
  // No anonymous request and no automatic preparation/mutation on mount.
  try{if(automatic){setBusy(true);void loadNavigationOrder(orderId,controller.signal).then(o=>{if(!controller.signal.aborted)setOrder(o);}).catch(e=>{if(!controller.signal.aborted)setMessage(errorMessage(e));}).finally(()=>{if(!controller.signal.aborted)setBusy(false);});} else if(common){setBusy(true);void loadCommonOrder(orderId,controller.signal).then(o=>{if(!controller.signal.aborted)setOrder(o);}).catch(e=>{if(!controller.signal.aborted)setMessage(errorMessage(e));}).finally(()=>{if(!controller.signal.aborted)setBusy(false);});}
  else {const a=readAttempt(orderId);setPairing(a.pairing||null);if(a.authorized)void readOrder(orderId,controller.signal).then(o=>{if(!controller.signal.aborted)setOrder(o);}).catch(e=>{if(!controller.signal.aborted)setMessage(errorMessage(e));}).finally(()=>{if(!controller.signal.aborted)setBusy(false);});else if(automatic){setBusy(true);void loadNavigationOrder(orderId,controller.signal).then(o=>{if(!controller.signal.aborted)setOrder(o);}).catch(()=>{if(!controller.signal.aborted)setMessage("Non e possibile aprire questo ordine. Torna al negozio e riprova.");}).finally(()=>{if(!controller.signal.aborted)setBusy(false);});}else{setBusy(false);setMessage("Torna al negozio per aprire il tuo ordine.");}}}catch(e){setBusy(false);setMessage(errorMessage(e));}
  return()=>{mounted.current=false;controller.abort();};
 },[orderId,common,automatic,revision]);
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
 return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-accent" />
            <span className="font-semibold text-lg">Checkout sicuro</span>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex items-center justify-center">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-2xl mx-auto text-center animate-fade-in">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-accent/10 mb-8">
              <Lock className="h-10 w-10 text-accent" />
            </div>

            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4 tracking-tight">
              Checkout sicuro
            </h1>

            {busy && (
              <p className="text-lg text-muted-foreground mb-10">
                Caricamento del tuo ordine...
              </p>
            )}

            {message && <div className="mb-10"><p role="alert" className="text-lg text-red-500 mb-4">{message}</p><Button variant="outline" disabled={busy} onClick={()=>setRevision(n=>n+1)}>Riprova</Button></div>}

            {order && (
              <>
                <p className="text-sm text-muted-foreground mb-2">ID ordine</p>
                <p className="font-mono text-xs break-all mb-6">{order.id}</p>

                <div className="text-3xl font-bold text-foreground mb-8">
                  {formatMoney(order.total,order.currency)}
                </div>

                <Button
                  disabled={busy || order.paymentStatus !== "PENDING"} onClick={()=>void run("pay")}
                  size="lg"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 px-8 py-6 text-lg font-medium shadow-lg shadow-primary/20 transition-all hover:shadow-xl hover:shadow-primary/30"
                >
                  <CreditCard className="mr-2 h-5 w-5" />
                  Paga ora
                </Button>

                {/* Trust indicators */}
                <div
                  className="mt-16 grid grid-cols-3 gap-6 max-w-lg mx-auto animate-slide-up"
                  style={{ animationDelay: "0.2s" }}
                >
                  <div className="text-center">
                    <div className="text-2xl font-bold text-foreground">
                      256-bit
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Crittografia SSL
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-foreground">
                      PCI
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Conforme
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-foreground">
                      100%
                    </div>
                    <div className="text-sm text-muted-foreground">Sicuro</div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          Protetto da misure di sicurezza conformi agli standard del settore
        </div>
      </footer>
    </div>
  );
}
