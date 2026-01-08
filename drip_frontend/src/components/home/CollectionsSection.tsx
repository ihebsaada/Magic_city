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
}

export const CollectionsSection = () => {
  const [collections, setCollections] = useState<CollectionWithImage[]>([]);

  useEffect(() => {
    const loadCollections = async () => {
      // 👉 maintenant on sait que ça renvoie CollectionSummary[]
      const collectionSummaries: CollectionSummary[] = await getCollections();

      const collectionsWithImages = await Promise.all(
        collectionSummaries.slice(0, 6).map(async (col: CollectionSummary) => {
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
            name: col.title, // on affiche le titre de la collection
            image,
          };
        })
      );

      setCollections(collectionsWithImages);
    };

    loadCollections().catch(console.error);
  }, []);

  return (
    <section className="py-16 md:py-24">
      <div className="container mx-auto px-4">
        <div className="mb-12 text-center">
          <h2 className="mb-4 font-serif text-4xl font-bold md:text-5xl">
            Scopri tutte le Collezioni
          </h2>
          <p className="mx-auto max-w-2xl text-muted-foreground">
            Una selezione curata delle migliori sneakers luxury dai brand più
            esclusivi del mondo
          </p>
        </div>

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
                <div className="absolute inset-0 bg-gradient-to-t from-primary/80 to-transparent" />
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-6 text-primary-foreground">
                <h3 className="mb-2 font-serif text-2xl font-bold">
                  {collection.name}
                </h3>
                <span className="inline-flex items-center text-sm font-medium transition-transform group-hover:translate-x-1">
                  Vedi collezione
                  <ArrowRight className="ml-2 h-4 w-4" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};
