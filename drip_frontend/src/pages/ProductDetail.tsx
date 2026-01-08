// src/pages/ProductDetail.tsx
import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  getProductByHandle,
  getProductsByCollection,
} from "@/services/productService";
import { Product } from "@/types/product";
import { Button } from "@/components/ui/button";
import { BadgeCustom } from "@/components/ui/badge-custom";
import { ProductCard } from "@/components/product/ProductCard";
import { Heart, ShoppingBag, Truck, RefreshCcw } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/contexts/WishlistContext";

const ProductDetail = () => {
  const { handle } = useParams<{ handle: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [mainImage, setMainImage] = useState<string>("");
  const { addToCart } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const navigate = useNavigate();

  useEffect(() => {
    const loadProduct = async () => {
      if (!handle) return;
      const foundProduct = await getProductByHandle(handle);
      if (foundProduct) {
        setProduct(foundProduct);
        setMainImage(foundProduct.mainImage);

        setSelectedColor("");
        setSelectedSize("");

        if (foundProduct.colors && foundProduct.colors.length > 0) {
          setSelectedColor(foundProduct.colors[0]);
        }

        if (foundProduct.sizes?.length) {
          setSelectedSize(foundProduct.sizes[0]);
        }

        // Load related products from same collection
        const collectionProducts = await getProductsByCollection(
          foundProduct.collection
        );
        const related = collectionProducts
          .filter((p) => p.id !== foundProduct.id)
          .slice(0, 4);
        setRelatedProducts(related);
      }
    };

    loadProduct().catch(console.error);
  }, [handle]);

  if (!product) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Prodotto non trovato</p>
      </div>
    );
  }

  const hasDiscount =
    product.compareAtPrice && product.compareAtPrice > product.price;
  const discountPercent = hasDiscount
    ? Math.round(
        ((product.compareAtPrice! - product.price) / product.compareAtPrice!) *
          100
      )
    : 0;

  const handleAddToCart = () => {
    if (!product) return;

    addToCart(
      product,
      1,
      selectedSize || undefined,
      selectedColor || undefined
    );

    navigate("/cart");
  };

  const handleToggleWishlist = () => {
    if (!product) return;
    toggleWishlist(product);
  };

  const inWishlist = product ? isInWishlist(product.id) : false;

  return (
    <div className="min-h-screen py-12">
      <div className="container mx-auto px-4">
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
                  €{product.price.toFixed(2)}
                </span>
                {hasDiscount && (
                  <>
                    <span className="text-xl text-muted-foreground line-through">
                      €{product.compareAtPrice!.toFixed(2)}
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
                {/* 🔹 ICI on utilise option2Name (ex: "Colore", "Color") */}
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
                {/* 🔹 ICI on utilise option1Name (ex: "Taglia", "Size") */}
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
            <div className="text-sm">
              {product.stock > 0 ? (
                <p className="text-green-600">
                  {product.stock} pezzi disponibili
                </p>
              ) : (
                <p className="text-destructive">Esaurito</p>
              )}
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <Button
                size="lg"
                className="w-full bg-primary hover:bg-primary/90"
                onClick={handleAddToCart}
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
                Aggiungi alla Lista dei Desideri
              </Button>
            </div>

            {/* Services */}
            <div className="space-y-3 border-t pt-6">
              <div className="flex items-center gap-3 text-sm">
                <Truck className="h-5 w-5 text-muted-foreground" />
                <span>Spedizione gratuita sopra €99,90</span>
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
                Spedizione gratuita per ordini superiori a €99,90. Consegna in
                24-48h in tutta Italia. Reso gratuito entro 30 giorni
                dall'acquisto.
              </p>
            </TabsContent>
          </Tabs>
        </div>

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
  );
};

export default ProductDetail;
