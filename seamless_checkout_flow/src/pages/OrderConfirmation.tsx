// export default OrderConfirmation;
import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { CheckCircle, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { clearCart } from "@/lib/cart";
import Navigation from "@/components/Navigation";

const API_URL =
  import.meta.env.VITE_PRIMARY_API_URL ?? "http://localhost:4000/api";

type ConfirmResponse = {
  paid: boolean;
  error?: string;
  // If your backend ever sends more, we’ll use it safely:
  order?: {
    id?: string;
    status?: string;
    total?: number; // cents
    createdAt?: string;
    items?: { genericName: string; price: number; quantity: number }[];
  };
};

const OrderConfirmation = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Support both just in case: ?orderId=... (your snippet) or ?order_id=...
  const orderId = useMemo(
    () => searchParams.get("orderId") ?? searchParams.get("order_id"),
    [searchParams]
  );
  const sessionId = useMemo(
    () => searchParams.get("session_id"),
    [searchParams]
  );

  const [loading, setLoading] = useState(true);
  const [paid, setPaid] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Optional: if confirm endpoint returns order details, we’ll display them
  const [order, setOrder] = useState<ConfirmResponse["order"] | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setError("Session_id (Stripe) mancante.");
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const res = await fetch(
          `${API_URL}/pay/confirm?session_id=${encodeURIComponent(sessionId)}`
        );
        const data: ConfirmResponse = await res.json();

        if (!res.ok) throw new Error(data?.error ?? "Conferma non riuscita");

        const isPaid = Boolean(data.paid);
        setPaid(isPaid);

        if (isPaid) {
          // Only clear cart AFTER payment is confirmed
          clearCart();
        }

        // If backend provides order details, store them (safe)
        if (data?.order) setOrder(data.order);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [sessionId]);

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const backToCheckoutHref = orderId
    ? `/checkout-landing?orderId=${encodeURIComponent(orderId)}`
    : "/checkout-landing";
  const SHOP_URL = import.meta.env.VITE_SHOP_URL ?? "/";

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

                {/* Keep UI sections, but only show items/total if backend provided them */}
                {order?.items?.length ? (
                  <>
                    <Separator />
                    <div>
                      <h3 className="font-medium mb-4">Articoli dell'ordine</h3>
                      <div className="space-y-3">
                        {order.items.map((item, index) => (
                          <div
                            key={index}
                            className="flex justify-between items-center py-2"
                          >
                            <div>
                              <span className="font-medium">
                                {item.genericName}
                              </span>
                              <span className="text-muted-foreground ml-2">
                                × {item.quantity}
                              </span>
                            </div>
                            <span className="font-mono">
                              {formatPrice(item.price * item.quantity)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {typeof order.total === "number" && (
                      <>
                        <Separator />
                        <div className="flex justify-between items-center">
                          <span className="text-lg font-medium">
                            Totale pagato
                          </span>
                          <span className="text-2xl font-bold font-mono">
                            {formatPrice(order.total)}
                          </span>
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <Separator />
                    <p className="text-sm text-muted-foreground">
                      Il pagamento è stato confermato.
                    </p>
                  </>
                )}

                <Button
                  onClick={() => {
                    window.location.href = SHOP_URL;
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
};

export default OrderConfirmation;
