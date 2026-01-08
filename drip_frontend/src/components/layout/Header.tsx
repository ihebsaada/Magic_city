import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Heart, ShoppingBag, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWishlist } from "@/contexts/WishlistContext";
import { useCart } from "@/contexts/CartContext";

export const Header = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  // 👉 on récupère les données des contexts
  const { items: wishlistItems } = useWishlist();
  const { getCartCount } = useCart();

  const wishlistCount = wishlistItems.length;
  const cartCount = getCartCount();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location]);

  const navLinks = [
    { label: "Home", path: "/" },
    { label: "Catalogo", path: "/catalog" },
    { label: "Collezioni", path: "/collections" },
    { label: "Contatti", path: "/contact" },
  ];

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full transition-all duration-300",
        scrolled
          ? "bg-background/95 backdrop-blur-sm shadow-sm"
          : "bg-background"
      )}
    >
      <div className="container mx-auto px-4">
        <div className="flex h-20 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <span>
              <img
                src="//magiccitydrip.com/cdn/shop/files/2_98ef3367-cacc-470a-8bfb-d612b9688d07.png?v=1760888443&width=165"
                alt="Magic City Drip logo"
                className="h-10 w-auto"
              />
            </span>
            <span className="font-serif text-2xl font-bold tracking-tight">
              Magic City Drip
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden items-center space-x-8 md:flex">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={cn(
                  "text-sm font-medium transition-colors hover:text-accent",
                  location.pathname === link.path
                    ? "text-foreground"
                    : "text-muted-foreground"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right Icons */}
          <div className="flex items-center space-x-4">
            {/* Wishlist */}
            <Link
              to="/wishlist"
              className="relative p-2 transition-colors hover:text-accent"
              aria-label="Wishlist"
            >
              <Heart className="h-5 w-5" />
              {wishlistCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-medium text-accent-foreground">
                  {wishlistCount}
                </span>
              )}
            </Link>

            {/* Cart */}
            <Link
              to="/cart"
              className="relative p-2 transition-colors hover:text-accent"
              aria-label="Cart"
            >
              <ShoppingBag className="h-5 w-5" />
              {cartCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-medium text-accent-foreground">
                  {cartCount}
                </span>
              )}
            </Link>

            {/* Mobile Menu Toggle */}
            <button
              className="p-2 md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <nav className="border-t py-4 md:hidden">
            <div className="flex flex-col space-y-3">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={cn(
                    "px-2 py-2 text-sm font-medium transition-colors",
                    location.pathname === link.path
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </nav>
        )}
      </div>
    </header>
  );
};
