// src/pages/Catalog.tsx
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  getProducts,
  getCollections,
  getProductsByCollection,
} from "@/services/productService";
import { Product, CollectionSummary } from "@/types/product";
import { ProductCard } from "@/components/product/ProductCard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const Catalog = () => {
  const [searchParams] = useSearchParams();
  const [selectedCollection, setSelectedCollection] = useState<string>("all");
  const [selectedSort, setSelectedSort] = useState<string>("featured");

  // 🔹 Tous les produits
  const { data: allProducts = [], isLoading: productsLoading } = useQuery<
    Product[]
  >({
    queryKey: ["products"],
    queryFn: getProducts,
  });

  // 🔹 Collections
  const { data: collections = [], isLoading: collectionsLoading } = useQuery<
    CollectionSummary[]
  >({
    queryKey: ["collections"],
    queryFn: getCollections,
  });

  // 🔹 Produits d'une collection spécifique (si sélectionnée)
  const {
    data: collectionProducts = [],
    isLoading: collectionProductsLoading,
  } = useQuery<Product[]>({
    queryKey: ["collectionProducts", selectedCollection],
    queryFn: () => getProductsByCollection(selectedCollection),
    enabled: selectedCollection !== "all",
  });

  const baseProducts: Product[] =
    selectedCollection === "all" ? allProducts : collectionProducts;

  const filteredProducts = useMemo(() => {
    let filtered = [...baseProducts];

    // Filtre URL (?filter=new / ?filter=sale)
    const filter = searchParams.get("filter");
    if (filter === "new") {
      filtered = filtered.filter((p) => p.isNew);
    } else if (filter === "sale") {
      filtered = filtered.filter((p) => p.isOnSale);
    }

    // Tri
    if (selectedSort === "price-asc") {
      filtered.sort((a, b) => a.price - b.price);
    } else if (selectedSort === "price-desc") {
      filtered.sort((a, b) => b.price - a.price);
    } else if (selectedSort === "name") {
      filtered.sort((a, b) => a.title.localeCompare(b.title));
    }

    return filtered;
  }, [baseProducts, searchParams, selectedSort]);

  const loading =
    productsLoading ||
    collectionsLoading ||
    (selectedCollection !== "all" && collectionProductsLoading);

  return (
    <div className="min-h-screen py-12">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="mb-4 font-serif text-4xl font-bold md:text-5xl">
            Catalogo
          </h1>
          <p className="text-muted-foreground">
            Esplora la nostra collezione completa di sneakers luxury
          </p>
        </div>

        {/* Filters */}
        <div className="mb-8 flex flex-wrap gap-4">
          <div className="w-full sm:w-48">
            <Select
              value={selectedCollection}
              onValueChange={setSelectedCollection}
            >
              <SelectTrigger>
                <SelectValue placeholder="Tutte le collezioni" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutte le collezioni</SelectItem>
                {collections.map((collection) => (
                  <SelectItem key={collection.handle} value={collection.handle}>
                    {collection.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-full sm:w-48">
            <Select value={selectedSort} onValueChange={setSelectedSort}>
              <SelectTrigger>
                <SelectValue placeholder="Ordina per" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="featured">In evidenza</SelectItem>
                <SelectItem value="price-asc">Prezzo: crescente</SelectItem>
                <SelectItem value="price-desc">Prezzo: decrescente</SelectItem>
                <SelectItem value="name">Nome: A-Z</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="ml-auto text-sm text-muted-foreground">
            {loading ? "Caricamento..." : `${filteredProducts.length} prodotti`}
          </div>
        </div>

        {/* Products Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>

        {!loading && filteredProducts.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-muted-foreground">Nessun prodotto trovato</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Catalog;
