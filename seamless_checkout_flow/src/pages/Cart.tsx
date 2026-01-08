import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Minus, Plus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import {
  getCart,
  updateQuantity,
  removeFromCart,
  getCartTotal,
  getEncryptedCart,
  getSessionId,
  CartItem,
} from "@/lib/cart";

const Cart = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setCart(getCart());
  }, []);

  const refreshCart = () => {
    setCart(getCart());
  };

  const handleQuantityChange = (itemId: string, delta: number) => {
    const item = cart.find(i => i.id === itemId);
    if (item) {
      updateQuantity(itemId, item.quantity + delta);
      refreshCart();
    }
  };

  const handleRemove = (itemId: string) => {
    removeFromCart(itemId);
    refreshCart();
  };

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast({
        title: "Cart is empty",
        description: "Please add items to your cart before checking out.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('checkout', {
        body: {
          sessionId: getSessionId(),
          encryptedCart: getEncryptedCart(),
          items: cart.map(item => ({
            genericName: item.genericName,
            price: item.price,
            quantity: item.quantity,
          })),
          total: getCartTotal(),
        },
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      toast({
        title: "Checkout failed",
        description: error.message || "Unable to process checkout. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const total = getCartTotal();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navigation />

      <main className="flex-1 py-8">
        <div className="container mx-auto px-4 max-w-3xl">
          <Card className="animate-fade-in">
            <CardHeader>
              <CardTitle className="text-2xl">Your Cart</CardTitle>
            </CardHeader>
            
            <CardContent>
              {cart.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  Your cart is empty
                </div>
              ) : (
                <div className="space-y-4">
                  {cart.map((item, index) => (
                    <div 
                      key={item.id} 
                      className="flex items-center gap-4 p-4 rounded-lg bg-muted/50 animate-slide-up"
                      style={{ animationDelay: `${index * 0.1}s` }}
                    >
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-foreground">
                          {item.genericName}
                        </h3>
                        <p className="text-sm text-muted-foreground truncate">
                          {item.description}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleQuantityChange(item.id, -1)}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-8 text-center font-mono">
                          {item.quantity}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleQuantityChange(item.id, 1)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="w-24 text-right font-mono font-medium">
                        {formatPrice(item.price * item.quantity)}
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemove(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>

            {cart.length > 0 && (
              <CardFooter className="flex-col gap-4">
                <Separator />
                <div className="w-full flex items-center justify-between py-2">
                  <span className="text-lg font-medium">Total</span>
                  <span className="text-2xl font-bold font-mono">
                    {formatPrice(total)}
                  </span>
                </div>
                
                <Button 
                  onClick={handleCheckout}
                  disabled={loading}
                  className="w-full bg-accent text-accent-foreground hover:bg-accent/90 py-6 text-lg font-medium"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    'Checkout'
                  )}
                </Button>

                <p className="text-xs text-muted-foreground text-center">
                  Secure payment powered by Stripe
                </p>
              </CardFooter>
            )}
          </Card>
        </div>
      </main>

      <footer className="border-t border-border py-6">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          Protected by industry-standard security measures
        </div>
      </footer>
    </div>
  );
};

export default Cart;
