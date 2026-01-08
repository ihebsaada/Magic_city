// src/components/home/BestSellersSection.tsx (ou où il est placé)
import { useEffect, useState } from "react";
import { getProducts } from "@/services/productService";
import { Product } from "@/types/product";
import { ProductCard } from "@/components/product/ProductCard";

export const BestSellersSection = () => {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    const loadProducts = async () => {
      const all = await getProducts();

      const best = all
        .filter((p) => {
          // certains produits peuvent ne pas avoir `tags`
          const tags = (p as any).tags as string[] | undefined;
          const isBestFlag = (p as any).isBestseller || (p as any).isBest;

          const hasBestTag =
            Array.isArray(tags) &&
            tags.some((t) => t.toLowerCase().includes("best")); // "best", "bestseller", etc.

          return isBestFlag || hasBestTag;
        })
        .slice(0, 8); // on en garde max 8

      // si jamais aucun produit “best”, on prend juste les 8 premiers
      setProducts(best.length > 0 ? best : all.slice(0, 8));
    };

    loadProducts().catch(console.error);
  }, []);

  if (products.length === 0) {
    return null; // rien à afficher, mais surtout pas d’erreur
  }

  return (
    <section className="py-16 md:py-24">
      <div className="container mx-auto px-4">
        <div className="mb-10 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-serif text-3xl font-bold md:text-4xl">
              Best Seller
            </h2>
            <p className="text-muted-foreground">
              I modelli più amati dai nostri clienti
            </p>
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </div>
    </section>
  );
};
