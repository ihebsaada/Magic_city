import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import type { CollectionSummary } from "@/types/product";
import { useCatalogue } from "@/hooks/useProducts";

// Each cover has its own observer: a slow cover never delays the other cards.
export function CollectionCard({ collection, showCount = false }: {
  collection: CollectionSummary;
  showCount?: boolean;
}) {
  const query = useCatalogue({ collection: collection.handle, pageSize: 1 });
  const image = query.data?.items[0]?.mainImage;
  return (
    <div className="relative">
      <Link to={`/collections/${collection.handle}`} className="group relative block overflow-hidden rounded-sm bg-muted">
        <div className="aspect-[4/5] overflow-hidden">
          {image && <img src={image} alt={collection.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />}
          {query.isPending && <span role="status" className="block p-4 text-sm">Caricamento immagine...</span>}
          <div className="absolute inset-0 bg-gradient-to-t from-primary/90 to-transparent" />
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-6 text-primary-foreground">
          <h2 className="mb-2 font-serif text-2xl font-bold">{collection.title}</h2>
          {showCount && <p className="mb-3 text-sm">{collection.productsCount} prodotti</p>}
          <span className="inline-flex items-center text-sm font-medium">Scopri la collezione<ArrowRight className="ml-2 h-4 w-4" /></span>
        </div>
      </Link>
      {query.isError && <div role="alert" className="p-2 text-sm">
        Immagine non disponibile. <button type="button" className="underline" onClick={() => { void query.refetch(); }}>Riprova</button>
      </div>}
    </div>
  );
}
