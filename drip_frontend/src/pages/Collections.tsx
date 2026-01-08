// src/pages/Collections.tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  getCollections,
  getProductsByCollection,
} from "@/services/productService";
import { CollectionSummary, Product } from "@/types/product";
import { ArrowRight } from "lucide-react";

interface CollectionWithImage {
  handle: string;
  name: string;
  image: string;
  count: number;
}

const Collections = () => {
  const [collections, setCollections] = useState<CollectionWithImage[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const loadCollections = async () => {
      setLoading(true);
      const collectionSummaries = await getCollections();

      const collectionsWithImages = await Promise.all(
        collectionSummaries.map(async (col: CollectionSummary) => {
          // On récupère quelques produits juste pour avoir une image “cover”
          let image = "";
          try {
            const products: Product[] = await getProductsByCollection(
              col.handle
            );
            const first = products[0];
            image = first?.mainImage ?? "";
          } catch (e) {
            console.error(
              "Error fetching products for collection",
              col.handle,
              e
            );
          }

          return {
            handle: col.handle,
            name: col.title,
            image,
            count: col.productsCount,
          };
        })
      );

      setCollections(collectionsWithImages);
      setLoading(false);
    };

    loadCollections().catch(console.error);
  }, []);

  return (
    <div className="min-h-screen py-12">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="mb-4 font-serif text-4xl font-bold md:text-5xl">
            Le Nostre Collezioni
          </h1>
          <p className="mx-auto max-w-2xl text-muted-foreground">
            Esplora le collezioni esclusive dei migliori brand luxury al mondo
          </p>
        </div>

        {loading && (
          <div className="py-16 text-center text-muted-foreground">
            Caricamento...
          </div>
        )}

        {/* Collections Grid */}
        {!loading && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {collections.map((collection) => (
              <Link
                key={collection.handle}
                to={`/collections/${collection.handle}`}
                className="group relative overflow-hidden rounded-sm bg-muted"
              >
                <div className="aspect-[4/5] overflow-hidden">
                  {collection.image && (
                    <img
                      src={collection.image}
                      alt={collection.name}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-primary/90 to-transparent" />
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-6 text-primary-foreground">
                  <h2 className="mb-1 font-serif text-2xl font-bold">
                    {collection.name}
                  </h2>
                  <p className="mb-3 text-sm text-primary-foreground/80">
                    {collection.count} prodotti
                  </p>
                  <span className="inline-flex items-center text-sm font-medium transition-transform group-hover:translate-x-1">
                    Scopri la collezione
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Collections;
