import { useEffect, useState, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useProduct, useCatalogue, useProductVariants } from "@/hooks/useProducts";
import { QueryFeedback } from "@/components/QueryFeedback";
import { selectedVariant, variantProduct } from '@/lib/productVariants';
import { cardAsProduct } from '@/services/productService';
import { validSelection } from "@/lib/cartValidation";
import { Button } from "@/components/ui/button";
import { BadgeCustom } from "@/components/ui/badge-custom";
import { ProductCard } from "@/components/product/ProductCard";
import { Heart, ShoppingBag, Truck, RefreshCcw } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/contexts/WishlistContext";

const ProductDetail = () => {
  const { handle } = useParams<{ handle: string }>();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();

  const [selectedSize, setSelectedSize] = useState<string>("");
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [mainImage, setMainImage] = useState<string>("");
  const initializedHandle = useRef<string>();

  // 🔹 ref + états pour la sticky bar
  const actionsRef = useRef<HTMLDivElement | null>(null);
  const [belowActions, setBelowActions] = useState(false);
  const [atBottom, setAtBottom] = useState(false);

  const productQuery = useProduct(handle);
  const variantsQuery = useProductVariants(productQuery.data);
  const product = useMemo(() => productQuery.data ? { ...productQuery.data, ...(variantsQuery.data ? {
    ...variantsQuery.data, description: productQuery.data.description, images: productQuery.data.images, mainImage: productQuery.data.mainImage,
  } : {}) } : productQuery.data, [productQuery.data, variantsQuery.data]);
  const productLoading = productQuery.isPending;
  const productError = productQuery.isError;
  const relatedQuery = useCatalogue({ collection: product?.collection, pageSize: 5 }, !!product?.collection);
  const collectionProducts = relatedQuery.data?.items.map(cardAsProduct) ?? [];
  const relatedProducts = collectionProducts.filter(
    (p) => p.id !== product?.id
  ).slice(0, 4);

  // 🔹 Init image, taille, couleur quand le produit est chargé
  useEffect(() => {
    if (!product) return;
    const changedProduct = initializedHandle.current !== product.handle;
    initializedHandle.current = product.handle;
    setMainImage((current) => validSelection(product, undefined, undefined, changedProduct ? undefined : current).image);
    setSelectedColor((current) => validSelection(product, undefined, changedProduct ? undefined : current).color ?? "");
    setSelectedSize((current) => validSelection(product, changedProduct ? undefined : current).size ?? "");
  }, [product]);

  // 🔹 Scroll handler : montre la sticky bar quand le bloc actions n'est plus visible
  useEffect(() => {
    if (!product) return;

    const handleScroll = () => {
      const el = actionsRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        const viewportHeight =
          window.innerHeight || document.documentElement.clientHeight;

        const isVisible = rect.top < viewportHeight && rect.bottom > 0;
        setBelowActions(!isVisible); // bloc actions plus visible -> sticky ON
      }

      // ✅ bas de page plus fiable (desktop + mobile)
      const bottomOffset = 180; // espace pour footer + mobile nav
      const scrollPosition = window.innerHeight + window.scrollY;
      const pageHeight = document.documentElement.scrollHeight;

      const isAtBottom = scrollPosition >= pageHeight - bottomOffset;
      setAtBottom(isAtBottom);
    };

    window.addEventListener("scroll", handleScroll);
    window.addEventListener("resize", handleScroll);

    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, [product]);

  // 🧠 Après chargement : pas de produit -> message
  if (!product && !productLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <QueryFeedback error={productError} onRetry={() => { void productQuery.refetch(); }} />
        {!productError && <p>Prodotto non trovato</p>}
      </div>
    );
  }

  // Only the primary product shows an initial loading state.
  if (!product) return <div className="container py-12"><QueryFeedback loading onRetry={() => { void productQuery.refetch(); }} /></div>;

  const variant = selectedVariant(product, selectedSize || undefined, selectedColor || undefined);
  const displayProduct = variant ? variantProduct(product, variant) : product;
  const canBuy = !!variant && variant.stock > 0 && !productQuery.isError && !variantsQuery.isError;
  const hasDiscount =
    displayProduct.compareAtPrice && displayProduct.compareAtPrice > displayProduct.price;
  const discountPercent = hasDiscount
    ? Math.round(
        ((displayProduct.compareAtPrice! - displayProduct.price) / displayProduct.compareAtPrice!) *
          100
      )
    : 0;

  const handleAddToCart = () => {
    if (!canBuy || !variant) return;
    addToCart(
      variantProduct(product, variant),
      1,
      selectedSize || undefined,
      selectedColor || undefined
    );

    navigate("/cart");
  };

  const handleToggleWishlist = () => {
    toggleWishlist(product);
  };

  const inWishlist = isInWishlist(product.id);

  // 🔹 Condition d’affichage de la sticky bar
  const showStickyBar = belowActions && !atBottom && canBuy;

  return (
    <>
      <div className="min-h-screen py-12">
        <div className="container mx-auto px-4">
          <QueryFeedback error={productQuery.isError} hasData onRetry={() => { void productQuery.refetch(); }} />
          {/* Product Main */}
          <div className="grid gap-8 lg:grid-cols-2">
            {/* Images */}
            <div className="space-y-4">
              <div className="aspect-square overflow-hidden rounded-sm bg-muted">
                <img
                  src={mainImage}
                  alt={product.title}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="grid grid-cols-4 gap-2">
                {product.images.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => setMainImage(image)}
                    className="aspect-square overflow-hidden rounded-sm bg-muted border-2 transition-colors hover:border-accent"
                    style={{
                      borderColor:
                        image === mainImage
                          ? "hsl(var(--accent))"
                          : "transparent",
                    }}
                  >
                    <img
                      src={image}
                      alt={`${product.title} ${index + 1}`}
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Info */}
            <div className="space-y-6">
              <div>
                <p className="mb-2 text-sm font-medium uppercase tracking-wider text-muted-foreground">
                  {product.brand}
                </p>
                <h1 className="mb-4 font-serif text-3xl font-bold md:text-4xl">
                  {product.title}
                </h1>
                <div className="flex items-center gap-3">
                  <span className="font-serif text-3xl font-bold">
                    {!variant && 'Prezzo indicativo: '}
                    €{displayProduct.price.toFixed(2)}
                  </span>
                  {hasDiscount && (
                    <>
                      <span className="text-xl text-muted-foreground line-through">
                        €{displayProduct.compareAtPrice!.toFixed(2)}
                      </span>
                      <BadgeCustom variant="sale">
                        -{discountPercent}%
                      </BadgeCustom>
                    </>
                  )}
                </div>
              </div>

              {/* Colors */}
              <div>
                <p className="mb-3 text-sm font-medium">
                  {(product.option2Name ?? "Colore") + ": "} {selectedColor}
                </p>
                <div className="flex gap-2">
                  {product.colors.map((color) => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className="rounded-sm border-2 px-4 py-2 text-sm transition-colors hover:border-accent"
                      style={{
                        borderColor:
                          color === selectedColor
                            ? "hsl(var(--accent))"
                            : "hsl(var(--border))",
                      }}
                    >
                      {color}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sizes */}
              <div>
                <p className="mb-3 text-sm font-medium">
                  {product.option1Name ?? "Taglia"}
                </p>
                <div className="flex flex-wrap gap-2">
                  {product.sizes.map((size) => (
                    <button
                      key={size}
                      onClick={() => setSelectedSize(size)}
                      className="h-12 w-12 rounded-sm border-2 transition-colors hover:border-accent"
                      style={{
                        borderColor:
                          size === selectedSize
                            ? "hsl(var(--accent))"
                            : "hsl(var(--border))",
                      }}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stock */}
              <QueryFeedback loading={variantsQuery.isFetching} error={variantsQuery.isError} hasData={variantsQuery.data !== undefined} onRetry={() => { void variantsQuery.refetch(); }} />
              <div className="text-sm">
                {variant && variant.stock > 0 ? (
                  <p className="text-green-600">
                    {variant?.stock} pezzi disponibili
                  </p>
                ) : (
                  <p className="text-destructive">{variant ? "Esaurito" : "Seleziona una combinazione valida e non ambigua di opzioni."}</p>
                )}
              </div>

              {/* Actions (bloc observé) */}
              <div className="space-y-3" ref={actionsRef}>
                <Button
                  size="lg"
                  className="w-full bg-primary hover:bg-primary/90"
                  onClick={handleAddToCart}
                  disabled={!canBuy}
                >
                  <ShoppingBag className="mr-2 h-5 w-5" />
                  Aggiungi al Carrello
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full"
                  onClick={handleToggleWishlist}
                >
                  <Heart className="mr-2 h-5 w-5" />
                  {inWishlist
                    ? "Rimuovi dalla Lista dei Desideri"
                    : "Aggiungi alla Lista dei Desideri"}
                </Button>
              </div>

              {/* Services */}
              <div className="space-y-3 border-t pt-6">
                <div className="flex items-center gap-3 text-sm">
                  <Truck className="h-5 w-5 text-muted-foreground" />
                  <span>Spedizione gratuita a partire da €200,00</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <RefreshCcw className="h-5 w-5 text-muted-foreground" />
                  <span>Reso gratuito entro 30 giorni</span>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-16">
            <Tabs defaultValue="description">
              <TabsList>
                <TabsTrigger value="description">Descrizione</TabsTrigger>
                <TabsTrigger value="details">Dettagli</TabsTrigger>
                <TabsTrigger value="shipping">Spedizione</TabsTrigger>
              </TabsList>
              <TabsContent value="description" className="mt-6">
                <p className="text-muted-foreground">{product.description}</p>
              </TabsContent>
              <TabsContent value="details" className="mt-6">
                <ul className="space-y-2 text-muted-foreground">
                  <li>• Brand: {product.brand}</li>
                  <li>• Materiali premium di alta qualità</li>
                  <li>• Prodotto autentico al 100%</li>
                  <li>• Suola in gomma per maggiore trazione</li>
                </ul>
              </TabsContent>
              <TabsContent value="shipping" className="mt-6">
                <p className="text-muted-foreground">
                  Spedizione gratuita per ordini a partire da €200,00. Consegna stimata in
                  7–10 giorni in tutta Italia. Reso gratuito entro 30 giorni
                  dall&apos;acquisto.
                </p>
              </TabsContent>
            </Tabs>
          </div>

          <div className="mt-16"><QueryFeedback loading={relatedQuery.isFetching} error={relatedQuery.isError} hasData={relatedQuery.data !== undefined} onRetry={() => { void relatedQuery.refetch(); }} /></div>
          {/* Related Products */}
          {relatedProducts.length > 0 && (
            <div className="mt-16">
              <h2 className="mb-8 font-serif text-3xl font-bold">
                Prodotti Correlati
              </h2>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {relatedProducts.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 🔹 Sticky Add to Cart bar */}
      {showStickyBar && (
        <div className="fixed inset-x-0 bottom-16 md:bottom-0 z-40 border-t bg-background/95 backdrop-blur">
          <div className="container mx-auto flex items-center justify-between gap-4 px-4 py-3">
            {/* Left side: title + size selector */}
            <div className="flex flex-1 flex-col gap-1">
              <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                {product.brand}
              </span>

              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium">
                  {product.title} · €{displayProduct.price.toFixed(2)}
                </span>

                {/* Taglia directement modifiable dans la sticky bar */}
                {product.sizes && product.sizes.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      Taglia
                    </span>
                    <select
                      value={selectedSize}
                      onChange={(e) => setSelectedSize(e.target.value)}
                      className="h-9 rounded-sm border bg-background px-2 text-xs"
                    >
                      {product.sizes.map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Right side: CTA */}
            <Button
              className="whitespace-nowrap px-6"
              size="lg"
              onClick={handleAddToCart}
              disabled={!canBuy}
            >
              Aggiungi al Carrello
            </Button>
          </div>
        </div>
      )}
    </>
  );
};

export default ProductDetail;
