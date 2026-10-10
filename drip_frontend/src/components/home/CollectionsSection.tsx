import {mobileTwoColumnGrid} from "@/components/product/ProductGrid";
import { useCollections } from '@/hooks/useProducts';
import { CollectionCard } from '@/components/CollectionCard';
import { QueryFeedback } from '@/components/QueryFeedback';
export const CollectionsSection = () => {
  const query = useCollections();
  return (
    <section className="py-16 md:py-24"><div className="container mx-auto px-4">
      <div className="mb-12 text-center">
        <h2 className="mb-4 font-serif text-4xl font-bold md:text-5xl">Scopri tutte le Collezioni</h2>
        <p className="mx-auto max-w-2xl text-muted-foreground">Una selezione curata delle migliori sneakers luxury dai brand più esclusivi del mondo</p>
      </div>
      <QueryFeedback loading={query.isFetching} error={query.isError} hasData={query.data !== undefined} onRetry={() => { void query.refetch(); }} />
      <div className={`${mobileTwoColumnGrid} sm:grid-cols-2 lg:grid-cols-3`}>
        {(query.data ?? []).slice(0, 6).map((collection) => <CollectionCard key={collection.handle} collection={collection} />)}
      </div>
      {!query.isPending && !query.isError && query.data?.length === 0 && <p>Nessuna collezione disponibile.</p>}
    </div></section>
  );
};
