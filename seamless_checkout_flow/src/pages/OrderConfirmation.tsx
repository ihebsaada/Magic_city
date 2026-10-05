import {storeUrl} from "@/lib/storeNavigation";
import {CheckCircle,Loader2,AlertCircle} from "lucide-react";
import {Card,CardContent,CardHeader,CardTitle} from "@/components/ui/card";
import {Separator} from "@/components/ui/separator";
import {useEffect,useRef,useState} from "react";
import {Link,useSearchParams,useNavigate} from "react-router-dom";
import Navigation from "@/components/Navigation";
import {Button} from "@/components/ui/button";
import {confirm,readOrder,formatMoney,errorMessage,type OrderMin} from "@/lib/secureCheckout";
export default function OrderConfirmation(){
 const [params]=useSearchParams(),orderId=params.get("orderId")||params.get("order_id")||"",sessionId=params.get("session_id")||"";
 const [order,setOrder]=useState<OrderMin|null>(null),[paid,setPaid]=useState(false),[error,setError]=useState(""),[loading,setLoading]=useState(true),[revision,setRevision]=useState(0);
 const budget=useRef(0);
 const navigate=useNavigate();
 const backToCheckoutHref="/checkout-landing?orderId="+encodeURIComponent(orderId);
 const formatDate=(value:string)=>new Date(value).toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric",hour:"2-digit",minute:"2-digit"});
 useEffect(()=>{
  const c=new AbortController();setOrder(null);setPaid(false);setError("");
  if(budget.current>=3){setError("Verifica da completare con assistenza. Nessun nuovo ordine.");return;}
  budget.current++;setLoading(true);
  void (async()=>{try{const result=await confirm(orderId,sessionId,c.signal);const o=await readOrder(orderId,c.signal);
   if(!c.signal.aborted){setOrder(o);setPaid(result.paid&&o.paymentStatus==="PAID");}
  }catch(e){if(!c.signal.aborted)setError(errorMessage(e));}finally{if(!c.signal.aborted)setLoading(false);}})();
  return()=>c.abort();
 },[orderId,sessionId,revision]);
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navigation />

      {/* Main Content */}
      <main className="flex-1 py-8">
        <div className="container mx-auto px-4 max-w-2xl">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
              <Loader2 className="h-12 w-12 text-accent animate-spin mb-4" />
              <p className="text-muted-foreground">Conferma del pagamento...</p>
            </div>
          ) : error ? (
            <Card className="animate-fade-in">
              <CardContent className="flex flex-col items-center py-12">
                <AlertCircle className="h-16 w-16 text-destructive mb-4" />
                <h2 className="text-xl font-semibold mb-2">
                  Impossibile confermare il pagamento
                </h2>
                <p className="text-muted-foreground mb-6">{error}</p>

                <div className="flex gap-3 flex-wrap justify-center">
                  <Button asChild variant="outline">
                    <Link to={backToCheckoutHref}>Torna al checkout</Link>
                  </Button>
                  <Button onClick={() => navigate("/")}>Torna alla home</Button>
                </div>
              </CardContent>
            </Card>
          ) : paid ? (
            <Card className="animate-fade-in">
              <CardHeader className="text-center pb-2">
                <div className="mx-auto w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mb-4">
                  <CheckCircle className="h-8 w-8 text-success" />
                </div>
                <CardTitle className="text-2xl">Ordine confermato</CardTitle>
                <p className="text-muted-foreground mt-2">
                  Grazie per il tuo acquisto
                </p>
              </CardHeader>

              <CardContent className="space-y-6">
                <div className="bg-muted/50 rounded-lg p-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">ID ordine</span>
                      <p className="font-mono font-medium">
                        {order?.id
                          ? `${order.id.slice(0, 8)}...`
                          : orderId
                          ? `${orderId.slice(0, 8)}...`
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Stato</span>
                      <p className="font-medium capitalize text-success">
                        {order?.status ?? "pagato"}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Data</span>
                      <p className="font-medium">
                        {order?.createdAt
                          ? formatDate(order.createdAt)
                          : formatDate(new Date().toISOString())}
                      </p>
                    </div>
                  </div>
                </div>

                <Separator />
                {order && <div className="flex justify-between items-center"><span className="text-lg font-medium">Totale pagato</span><span className="text-2xl font-bold font-mono">{formatMoney(order.total,order.currency)}</span></div>}
                <Button
                  onClick={() => {
                    window.location.assign(storeUrl("/"));
                  }}
                  className="w-full"
                  variant="outline"
                >
                  Continua a fare acquisti
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="animate-fade-in">
              <CardContent className="flex flex-col items-center py-12">
                <AlertCircle className="h-16 w-16 text-destructive mb-4" />
                <h2 className="text-xl font-semibold mb-2">
                  Pagamento non completato
                </h2>
                <p className="text-muted-foreground mb-6">
                  Puoi riprovare a completare il pagamento.
                </p>
                <div className="flex gap-3 flex-wrap justify-center">
                  <Button asChild variant="outline">
                    <Link to={backToCheckoutHref}>Torna al checkout</Link>
                  </Button>
                  <Button onClick={() => navigate("/")}>Torna alla home</Button>
                </div>
              </CardContent>
            </Card>
          )}
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
