import { Link, useLocation } from "react-router-dom";
import { Shield, ShoppingCart, Home } from "lucide-react";
import { getCart } from "@/lib/cart";
import { useEffect, useState } from "react";

const Navigation = () => {
  const location = useLocation();
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    const updateCartCount = () => {
      const cart = getCart();
      setCartCount(cart.reduce((sum, item) => sum + item.quantity, 0));
    };

    updateCartCount();
    
    // Update cart count on storage changes
    const handleStorageChange = () => updateCartCount();
    window.addEventListener("storage", handleStorageChange);
    
    // Poll for changes since sessionStorage doesn't trigger events in same tab
    const interval = setInterval(updateCartCount, 1000);
    
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <Shield className="h-6 w-6 text-accent" />
            <span className="font-semibold text-lg text-foreground">Secure Shop</span>
          </Link>

          <nav className="flex items-center gap-6">
            <Link
              to="/"
              className={`flex items-center gap-2 text-sm font-medium transition-colors hover:text-accent ${
                isActive("/") ? "text-accent" : "text-muted-foreground"
              }`}
            >
              <Home className="h-4 w-4" />
              <span className="hidden sm:inline">Shop</span>
            </Link>

            <Link
              to="/cart"
              className={`flex items-center gap-2 text-sm font-medium transition-colors hover:text-accent relative ${
                isActive("/cart") ? "text-accent" : "text-muted-foreground"
              }`}
            >
              <ShoppingCart className="h-4 w-4" />
              <span className="hidden sm:inline">Cart</span>
              {cartCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-accent text-accent-foreground text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                  {cartCount > 9 ? "9+" : cartCount}
                </span>
              )}
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Navigation;
