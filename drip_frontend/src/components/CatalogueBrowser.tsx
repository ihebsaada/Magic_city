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
    <form className="mb-6 flex flex-wrap gap-3" key={params.toString()} onSubmit={(event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const next = new URLSearchParams(params);
      for (const name of ['search', 'vendor', 'size', 'color', 'minPrice', 'maxPrice']) {
        const value = String(data.get(name) ?? '').trim();
        if (value) next.set(name, value); else next.delete(name);
      }
      next.delete('page'); setParams(next);
    }}>
      {['search', 'vendor', 'size', 'color', 'minPrice', 'maxPrice'].map((name) => <label key={name} className="text-sm">
        {{ search: 'Ricerca', vendor: 'Marca', size: 'Taglia', color: 'Colore', minPrice: 'Prezzo da', maxPrice: 'Prezzo fino' }[name]}
        <input className="block rounded border p-2 bg-background" name={name} defaultValue={params.get(name) ?? ''}
          maxLength={128} type={name.includes('Price') ? 'number' : 'text'} min={name.includes('Price') ? 0 : undefined} step={name.includes('Price') ? '0.01' : undefined} />
      </label>)}
      <button type="submit" className="rounded border px-4">Applica</button>
    </form>
    <div className="mb-6 flex flex-wrap gap-4">
      {!collection && <label>Collezione <select className="border rounded p-2 bg-background" value={params.get('collection') ?? ''} onChange={(e) => update('collection', e.target.value)}>
        <option value="">Tutte le collezioni</option>
        {(collections.data ?? []).map((item) => <option key={item.handle} value={item.handle}>{item.title}</option>)}
      </select></label>}
      <label>Ordina <select className="border rounded p-2 bg-background" value={sort} onChange={(e) => update('sort', e.target.value)}>
        {sorts.map((value) => <option key={value} value={value}>{{ featured: 'In evidenza', name: 'Nome: A-Z', 'name-desc': 'Nome: Z-A', 'price-asc': 'Prezzo: crescente', 'price-desc': 'Prezzo: decrescente', 'id-asc': 'ID crescente', 'id-desc': 'ID decrescente' }[value]}</option>)}
      </select></label>
      <label>Disponibilità <select className="border rounded p-2 bg-background" value={params.get('inStock') ?? ''} onChange={(e) => update('inStock', e.target.value)}>
        <option value="">Tutti</option><option value="true">Disponibili</option><option value="false">Esauriti</option>
      </select></label>
      <label>Selezione <select className="border rounded p-2 bg-background" value={params.get('filter') ?? ''} onChange={(e) => update('filter', e.target.value)}>
        <option value="">Tutti i prodotti</option><option value="sale">In saldo</option><option value="new">Novità</option>
      </select></label>
    </div>
    {!collection && <QueryFeedback error={collections.isError} hasData={collections.data !== undefined} onRetry={() => { void collections.refetch(); }} />}
    {unsupportedNew ? <p role="status">Le novità non sono ancora disponibili nel catalogo.</p> : <>
      <QueryFeedback loading={query.isFetching} error={query.isError} hasData={query.data !== undefined} onRetry={() => { void query.refetch(); }} />
      <p className="mb-4 text-sm text-muted-foreground">{query.data ? `${query.data.pagination.total} prodotti` : 'Caricamento...'}</p>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{products.map((item) => <ProductCard key={item.id} product={cardAsProduct(item)} />)}</div>
      {!query.isPending && !query.isError && !products.length && <p className="py-12 text-center">Nessun prodotto trovato</p>}
      {query.data && <nav aria-label="Pagine catalogo" className="mt-8 flex justify-center items-center gap-4">
        <button className="border rounded p-2" disabled={page <= 1 || query.isFetching} onClick={() => update('page', String(page - 1))}>Precedente</button>
        <span>Pagina {page} / {Math.max(1, query.data.pagination.totalPages)}</span>
        <button className="border rounded p-2" disabled={!query.data.pagination.hasNext || query.isFetching} onClick={() => update('page', String(page + 1))}>Successiva</button>
      </nav>}
    </>}
  </>;
}
