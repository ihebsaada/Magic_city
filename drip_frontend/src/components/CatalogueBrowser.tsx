import {ProductGrid} from "@/components/product/ProductGrid";
import {Button} from '@/components/ui/button';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select';
import { useSearchParams } from 'react-router-dom';
import { useCatalogue, useCollections } from '@/hooks/useProducts';
import { cardAsProduct } from '@/services/productService';
import type { CatalogueSort } from '@/types/product';
import { ProductCard } from '@/components/product/ProductCard';
import { QueryFeedback } from '@/components/QueryFeedback';

const sorts: CatalogueSort[] = ['featured', 'name', 'name-desc', 'price-asc', 'price-desc', 'id-asc', 'id-desc'];
export function CatalogueBrowser({ collection }: { collection?: string }) {
  const [params, setParams] = useSearchParams();
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next);
  };
  const rawPage = Number(params.get('page') ?? 1);
  const page = Number.isInteger(rawPage) && rawPage > 0 && rawPage <= 1_000_000 ? rawPage : 1;
  const rawSort = params.get('sort') as CatalogueSort;
  const sort = sorts.includes(rawSort) ? rawSort : 'featured';
  const unsupportedNew = params.get('filter') === 'new';
  const query = useCatalogue({ page, pageSize: 24, sort, collection: collection ?? params.get('collection') ?? undefined,
    search: params.get('search') || undefined, vendor: params.get('vendor') || undefined,
    size: params.get('size') || undefined, color: params.get('color') || undefined,
    minPrice: params.get('minPrice') || undefined, maxPrice: params.get('maxPrice') || undefined,
    sale: params.get('filter') === 'sale' ? true : undefined,
    inStock: params.get('inStock') === 'true' ? true : params.get('inStock') === 'false' ? false : undefined,
  }, !unsupportedNew);
  const collections = useCollections();
  const products = query.data?.items ?? [];
  return <>
    <div className="mb-8 flex flex-wrap gap-4">
      {!collection && <div className="w-full sm:w-48"><Select value={params.get('collection') ?? 'all'} onValueChange={value=>update('collection',value==='all'?'':value)}>
      <SelectTrigger><SelectValue placeholder="Tutte le collezioni"/></SelectTrigger><SelectContent><SelectItem value="all">Tutte le collezioni</SelectItem>
      {(collections.data ?? []).map(item=><SelectItem key={item.handle} value={item.handle}>{item.title}</SelectItem>)}</SelectContent></Select></div>}
      {!collection && <div className="w-full sm:w-48"><Select value={sort} onValueChange={value=>update('sort',value)}>
      <SelectTrigger><SelectValue placeholder="Ordina per"/></SelectTrigger><SelectContent>
      <SelectItem value="featured">In evidenza</SelectItem><SelectItem value="price-asc">Prezzo: crescente</SelectItem><SelectItem value="price-desc">Prezzo: decrescente</SelectItem><SelectItem value="name">Nome: A-Z</SelectItem>
      </SelectContent></Select></div>}
      <div className="ml-auto text-sm text-muted-foreground">{query.data ? query.data.pagination.total + (collection ? ' prodotti disponibili' : ' prodotti') : 'Caricamento...'}</div>
    </div>
    {!collection && <QueryFeedback error={collections.isError} hasData={collections.data !== undefined} onRetry={() => { void collections.refetch(); }} />}
    {unsupportedNew ? <p role="status">Le novità non sono ancora disponibili nel catalogo.</p> : <>
      <QueryFeedback loading={query.isFetching} error={query.isError} hasData={query.data !== undefined} onRetry={() => { void query.refetch(); }} />
      <ProductGrid className="sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{products.map((item) => <ProductCard key={item.id} product={cardAsProduct(item)} />)}</ProductGrid>
      {!query.isPending && !query.isError && !products.length && <div className="py-16 text-center"><p className="text-muted-foreground">{collection ? "Nessun prodotto trovato in questa collezione" : "Nessun prodotto trovato"}</p></div>}
      {query.data && <nav aria-label="Pagine catalogo" aria-busy={query.isFetching} className="mt-10 flex flex-wrap justify-center items-center gap-3 min-h-12">
        <Button variant="outline" className="min-h-11 min-w-24 rounded-full px-5" disabled={page <= 1 || query.isFetching} onClick={() => update('page', String(page - 1))}>Precedente</Button>
        <span aria-current="page" aria-live="polite" className="min-w-28 text-center text-sm font-medium tabular-nums">Pagina {page} / {Math.max(1, query.data.pagination.totalPages)}</span>
        <Button variant="outline" className="min-h-11 min-w-24 rounded-full px-5" disabled={!query.data.pagination.hasNext || query.isFetching} onClick={() => update('page', String(page + 1))}>Successiva</Button>
      </nav>}
    </>}
  </>;
}
