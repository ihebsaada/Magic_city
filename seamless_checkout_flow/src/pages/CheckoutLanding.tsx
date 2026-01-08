// export default CheckoutLanding;

import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Shield, Lock, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";

type OrderMin = {
  id: string;
  total: number;
  currency: string;
  status: string;
  paymentStatus: string;
  createdAt: string;
};

const API_URL =
  import.meta.env.VITE_PRIMARY_API_URL ?? "http://localhost:4000/api";

const CheckoutLanding = () => {
  const [params] = useSearchParams();
  const orderId = params.get("orderId");

  const [order, setOrder] = useState<OrderMin | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) {
      setError("Missing orderId. Please start checkout from the main shop.");
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const res = await fetch(`${API_URL}/orders/${orderId}/min`);
        if (!res.ok) throw new Error(await res.text());
        const data = (await res.json()) as OrderMin;
        setOrder(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [orderId]);

  const handlePay = async () => {
    if (!orderId) {
      alert("Missing orderId");
      return;
    }

    try {
      const res = await fetch(`${API_URL}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });

      if (!res.ok) {
        console.error(await res.text());
        alert("Payment init failed (check console)");
        return;
      }

      const data = (await res.json()) as { url: string; sessionId: string };

      if (!data.url) {
        alert("Stripe URL missing in response");
        return;
      }

      window.location.href = data.url;
    } catch (e) {
      console.error(e);
      alert("Network error (check backend running)");
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-accent" />
            <span className="font-semibold text-lg">Secure Checkout</span>
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
              Secure Checkout
            </h1>

            {loading && (
              <p className="text-lg text-muted-foreground mb-10">
                Loading your order…
              </p>
            )}

            {error && <p className="text-lg text-red-500 mb-10">{error}</p>}

            {order && (
              <>
                <p className="text-sm text-muted-foreground mb-2">Order ID</p>
                <p className="font-mono text-xs break-all mb-6">{order.id}</p>

                <div className="text-3xl font-bold text-foreground mb-8">
                  {order.total} {order.currency}
                </div>

                <Button
                  onClick={handlePay}
                  size="lg"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 px-8 py-6 text-lg font-medium shadow-lg shadow-primary/20 transition-all hover:shadow-xl hover:shadow-primary/30"
                >
                  <CreditCard className="mr-2 h-5 w-5" />
                  Pay now
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
                      SSL Encryption
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-foreground">
                      PCI
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Compliant
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-foreground">
                      100%
                    </div>
                    <div className="text-sm text-muted-foreground">Secure</div>
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
          Protected by industry-standard security measures
        </div>
      </footer>
    </div>
  );
};

export default CheckoutLanding;
