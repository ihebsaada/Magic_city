import { Link } from "react-router-dom";
import { Heart } from "lucide-react";
import { Product } from "@/types/product";
import { BadgeCustom } from "@/components/ui/badge-custom";
import { cn } from "@/lib/utils";
import { useWishlist } from "@/contexts/WishlistContext";

interface ProductCardProps {
  product: Product;
  className?: string;
}

export const ProductCard = ({ product, className }: ProductCardProps) => {
  const hasDiscount =
    product.compareAtPrice && product.compareAtPrice > product.price;
  const discountPercent = hasDiscount
    ? Math.round(
        ((product.compareAtPrice! - product.price) / product.compareAtPrice!) *
          100
      )
    : 0;

  // 👉 Connexion au contexte wishlist
  const { toggleWishlist, isInWishlist } = useWishlist();
  const inWishlist = isInWishlist(product.id);

  return (
    <div className={cn("group relative", className)}>
      <Link to={`/product/${product.handle}`} className="block">
        {/* Image Container */}
        <div className="relative aspect-square overflow-hidden bg-muted">
          <img
            src={product.mainImage}
            alt={product.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />

          {/* Badges */}
          <div className="absolute left-2 top-2 flex flex-col gap-1">
            {product.isNew && <BadgeCustom variant="new">Nuovo</BadgeCustom>}
            {product.isOnSale && hasDiscount && (
              <BadgeCustom variant="sale">-{discountPercent}%</BadgeCustom>
            )}
          </div>

          {/* Wishlist Button */}
          <button
            type="button"
            className={cn(
              "absolute right-2 top-2 rounded-full bg-background/80 p-2 backdrop-blur-sm transition-opacity hover:bg-background",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              "group-hover:opacity-100",
              inWishlist ? "opacity-100" : "opacity-0"
            )}
            onClick={(e) => {
              e.preventDefault(); // ne pas ouvrir la page produit
              e.stopPropagation();
              toggleWishlist(product);
            }}
            aria-label={inWishlist ? "Remove from wishlist" : "Add to wishlist"}
            aria-pressed={inWishlist}
          >
            <Heart
              className="h-4 w-4"
              fill={inWishlist ? "currentColor" : "none"}
            />
          </button>
        </div>

        {/* Product Info */}
        <div className="mt-3 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {product.brand}
          </p>
          <h3 className="line-clamp-2 text-sm font-medium transition-colors group-hover:text-accent">
            {product.title}
          </h3>
          <div className="flex items-center gap-2">
            <span className="font-semibold">€{product.price.toFixed(2)}</span>
            {hasDiscount && (
              <span className="text-sm text-muted-foreground line-through">
                €{product.compareAtPrice!.toFixed(2)}
              </span>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
};
