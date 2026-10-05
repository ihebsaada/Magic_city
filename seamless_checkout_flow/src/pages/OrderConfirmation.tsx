import {useEffect,useRef,useState} from "react";
import {Link,useSearchParams} from "react-router-dom";
import Navigation from "@/components/Navigation";
import {Button} from "@/components/ui/button";
import {confirm,readOrder,formatMoney,errorMessage,type OrderMin} from "@/lib/secureCheckout";
import StoreLink from "@/components/StoreLink";
export default function OrderConfirmation(){
 const [params]=useSearchParams(),orderId=params.get("orderId")||params.get("order_id")||"",sessionId=params.get("session_id")||"";
 const [order,setOrder]=useState<OrderMin|null>(null),[paid,setPaid]=useState(false),[error,setError]=useState(""),[loading,setLoading]=useState(false),[revision,setRevision]=useState(0);
 const budget=useRef(0);
 useEffect(()=>{
  const c=new AbortController();setOrder(null);setPaid(false);setError("");
  if(budget.current>=3){setError("Verifica da completare con assistenza. Nessun nuovo ordine.");return;}
  budget.current++;setLoading(true);
  void (async()=>{try{const result=await confirm(orderId,sessionId,c.signal);const o=await readOrder(orderId,c.signal);
   if(!c.signal.aborted){setOrder(o);setPaid(result.paid&&o.paymentStatus==="PAID");}
  }catch(e){if(!c.signal.aborted)setError(errorMessage(e));}finally{if(!c.signal.aborted)setLoading(false);}})();
  return()=>c.abort();
 },[orderId,sessionId,revision]);
 return <div className="min-h-screen bg-background"><Navigation/><main className="max-w-xl mx-auto p-6 space-y-4">
 <h1 className="text-2xl font-bold">{paid?"Ordine confermato":"Verifica del pagamento"}</h1>
 {loading&&<p role="status">Verifica in corso...</p>}{error&&<p role="alert">{error}</p>}
 {order&&<><p>Ordine: {order.id}</p><p>Totale: {formatMoney(order.total,order.currency)}</p><p>Stato pagamento: {order.paymentStatus}</p></>}
 {!paid&&<><Button disabled={loading||budget.current>=3} onClick={()=>setRevision(v=>v+1)}>Ripeti verifica della stessa sessione</Button><Link className="block underline" to={"/checkout-landing?orderId="+encodeURIComponent(orderId)}>Riprendi questo ordine</Link></>}
 <StoreLink>Torna al carrello Store</StoreLink>
 <p>Un ritorno Stripe non prova il pagamento. Se la sessione salvata manca o non coincide, richiedi una verifica; nessun ordine nuovo viene creato.</p>
 </main></div>;
}
