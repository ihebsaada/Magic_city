import { Link } from "react-router-dom";
import { useWishlist } from "@/contexts/WishlistContext";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { Heart, ShoppingCart, Trash2, ArrowLeft } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const Wishlist = () => {
  const { items, removeFromWishlist } = useWishlist();
  const { addToCart, isInCart } = useCart();

  const handleAddToCart = (product: (typeof items)[0]) => {
    const defaultColor = product.colors?.[0] ?? "";
    const defaultSize = product.sizes?.[0] ?? "";
    addToCart(product, 1, defaultSize, defaultColor);
    toast({
      title: "Aggiunto al carrello",
      description: `${product.title} è stato aggiunto al carrello.`,
    });
  };

  if (items.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
        <Heart className="h-16 w-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-serif font-semibold mb-2">
          La tua wishlist è vuota
        </h1>
        <p className="text-muted-foreground mb-6 text-center">
          Non hai ancora aggiunto prodotti alla lista dei desideri.
        </p>
        <Button asChild>
          <Link to="/catalog">Scopri il Catalogo</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-serif font-semibold">
          Lista dei Desideri
        </h1>
        <p className="text-muted-foreground mt-1">
          {items.length} {items.length === 1 ? "articolo" : "articoli"} salvati
        </p>
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {items.map((product) => {
          const hasDiscount =
            product.compareAtPrice && product.compareAtPrice > product.price;

          const discountPercent = hasDiscount
            ? Math.round(
                ((product.compareAtPrice! - product.price) /
                  product.compareAtPrice!) *
                  100
              )
            : 0;

          const defaultSize = product.sizes?.[0];
          const defaultColor = product.colors?.[0];

          const alreadyInCart = isInCart(product.id, defaultSize, defaultColor);

          return (
            <div
              key={product.id}
              className="group relative border border-border rounded-lg overflow-hidden bg-card"
            >
              {/* Image */}
              <Link to={`/product/${product.handle}`} className="block">
                <div className="relative aspect-square overflow-hidden">
                  <img
                    src={product.mainImage}
                    alt={product.title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  {/* Badges */}
                  <div className="absolute left-2 top-2 flex flex-col gap-1">
                    {product.isNew && (
                      <span className="bg-accent text-accent-foreground text-xs font-semibold px-2 py-1 rounded">
                        Nuovo
                      </span>
                    )}
                    {product.isOnSale && hasDiscount && (
                      <span className="bg-destructive text-destructive-foreground text-xs font-semibold px-2 py-1 rounded">
                        -{discountPercent}%
                      </span>
                    )}
                  </div>
                </div>
              </Link>

              {/* Product Info */}
              <div className="p-4">
                <Link
                  to={`/product/${product.handle}`}
                  className="hover:text-accent transition-colors"
                >
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {product.brand}
                  </p>
                  <h3 className="font-medium line-clamp-2 mt-1">
                    {product.title}
                  </h3>
                </Link>

                <div className="flex items-center gap-2 mt-2">
                  <span className="font-semibold">
                    €{product.price.toFixed(2)}
                  </span>
                  {hasDiscount && (
                    <span className="text-sm text-muted-foreground line-through">
                      €{product.compareAtPrice!.toFixed(2)}
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-4">
                  <Button
                    onClick={() => handleAddToCart(product)}
                    className="flex-1"
                    size="sm"
                    disabled={alreadyInCart}
                  >
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    {alreadyInCart ? "Nel carrello" : "Aggiungi"}
                  </Button>
                  <Button
                    onClick={() => removeFromWishlist(product.id)}
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Continue Shopping */}
      <div className="mt-12 text-center">
        <Link
          to="/catalog"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Continua lo shopping
        </Link>
      </div>
    </div>
  );
};

export default Wishlist;
