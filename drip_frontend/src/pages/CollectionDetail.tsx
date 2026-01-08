// src/pages/CollectionDetail.tsx
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getProductsByCollection } from "@/services/productService";
import { Product } from "@/types/product";
import { ProductCard } from "@/components/product/ProductCard";

const CollectionDetail = () => {
  const { collectionHandle } = useParams<{ collectionHandle: string }>();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProducts = async () => {
      if (!collectionHandle) return;
      setLoading(true);
      const collectionProducts = await getProductsByCollection(
        collectionHandle
      );
      setProducts(collectionProducts);
      setLoading(false);
    };

    loadProducts().catch(console.error);
  }, [collectionHandle]);

  const collectionName = collectionHandle
    ?.split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Caricamento...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      {products.length > 0 && (
        <div className="relative h-[400px] w-full overflow-hidden">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${products[0].mainImage})` }}
          />
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative flex h-full items-center justify-center">
            <div className="container mx-auto px-4 text-center">
              <h1 className="mb-4 font-serif text-5xl font-bold text-white md:text-6xl">
                {collectionName}
              </h1>
              <p className="text-lg text-white/90">
                Scopri i modelli esclusivi di questa collezione
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 py-12">
        {/* Counter */}
        <div className="mb-8 text-sm text-muted-foreground">
          {products.length} prodotti disponibili
        </div>

        {/* Products Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>

        {products.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-muted-foreground">
              Nessun prodotto trovato in questa collezione
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CollectionDetail;
