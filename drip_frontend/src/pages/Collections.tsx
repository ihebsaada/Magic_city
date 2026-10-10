import {mobileTwoColumnGrid} from "@/components/product/ProductGrid";
import { useCollections } from '@/hooks/useProducts';
import { CollectionCard } from '@/components/CollectionCard';
import { QueryFeedback } from '@/components/QueryFeedback';
const Collections = () => {
  const query = useCollections();
  const collections = query.data ?? [];
  return (
    <div className="min-h-screen py-12"><div className="container mx-auto px-4">
      <div className="mb-12 text-center">
        <h1 className="mb-4 font-serif text-4xl font-bold md:text-5xl">Le Nostre Collezioni</h1>
        <p className="mx-auto max-w-2xl text-muted-foreground">Esplora le collezioni esclusive dei migliori brand luxury al mondo</p>
      </div>
      <QueryFeedback loading={query.isFetching} error={query.isError} hasData={query.data !== undefined} onRetry={() => { void query.refetch(); }} />
      {query.isPending && <div className={`${mobileTwoColumnGrid} sm:grid-cols-2 lg:grid-cols-3`} aria-hidden="true">
        {Array.from({ length: 6 }, (_, i) => <div key={i} className="h-64 rounded-sm bg-muted animate-pulse" />)}
      </div>}
      <div className={`${mobileTwoColumnGrid} sm:grid-cols-2 lg:grid-cols-3`}>
        {collections.map((collection) => <CollectionCard key={collection.handle} collection={collection} showCount />)}
      </div>
      {!query.isPending && !query.isError && collections.length === 0 && <p className="py-8">Nessuna collezione disponibile.</p>}
    </div></div>
  );
};
export default Collections;
