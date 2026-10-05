// src/components/home/BestSellersSection.tsx (ou où il est placé)
import { useCatalogue } from "@/hooks/useProducts";
import { QueryFeedback } from "@/components/QueryFeedback";
import { cardAsProduct } from '@/services/productService';
import { ProductCard } from "@/components/product/ProductCard";

export const BestSellersSection = () => {
  const query = useCatalogue({ pageSize: 8 });
  // The public contract has no sales ranking; retain its existing first-eight fallback.
  const products = query.data?.items.map(cardAsProduct) ?? [];
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

        <QueryFeedback loading={query.isFetching} error={query.isError} hasData={query.data !== undefined} onRetry={() => { void query.refetch(); }} />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </div>
    </section>
  );
};
