// src/components/layout/MobileBottomNav.tsx
import { Link, useLocation } from "react-router-dom";
import { Home, Store, Heart, ShoppingBag } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/contexts/WishlistContext";

const navItems = [
  { to: "/", label: "Casa", icon: Home },
  { to: "/catalog", label: "Negozio", icon: Store },
  {
    to: "/wishlist",
    label: "Lista dei desideri",
    icon: Heart,
    badgeType: "wishlist" as const,
  },
  {
    to: "/cart",
    label: "Carrello",
    icon: ShoppingBag,
    badgeType: "cart" as const,
  },
];

export const MobileBottomNav = () => {
  const location = useLocation();
  const { getCartCount } = useCart();
  const { items: wishlistItems } = useWishlist();

  const cartCount = getCartCount();
  const wishlistCount = wishlistItems.length;

  const getBadgeCount = (type?: "cart" | "wishlist") => {
    if (type === "cart") return cartCount;
    if (type === "wishlist") return wishlistCount;
    return 0;
  };

  return (
    <nav
      className="
        fixed inset-x-0 bottom-2 z-40 flex justify-center
        md:hidden
        pb-[env(safe-area-inset-bottom,0px)]
      "
    >
      {/* pill centrée */}
      <div
        className="
          mx-auto flex w-[95%] max-w-md items-center justify-between
          rounded-2xl bg-white/95 px-3 py-2
          shadow-[0_-4px_18px_rgba(0,0,0,0.15)]
          border border-gray-200
        "
      >
        {navItems.map(({ to, label, icon: Icon, badgeType }) => {
          const isActive =
            location.pathname === to ||
            (to !== "/" && location.pathname.startsWith(to));

          const badge = getBadgeCount(badgeType);

          return (
            <Link
              key={to}
              to={to}
              className="flex flex-1 flex-col items-center gap-1 text-[10px]"
            >
              <div
                className={[
                  "relative flex h-8 w-8 items-center justify-center rounded-full border transition-colors",
                  isActive
                    ? "border-black bg-black text-white"
                    : "border-gray-300 bg-white text-gray-800",
                ].join(" ")}
              >
                <Icon className="h-4 w-4" />

                {badge > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-semibold text-white">
                    {badge > 9 ? "9+" : badge}
                  </span>
                )}
              </div>
              <span
                className={
                  "leading-none " +
                  (isActive
                    ? "font-semibold text-black"
                    : "font-medium text-gray-600")
                }
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
