import type { Product, CollectionSummary, CatalogueFilters, CataloguePage, CatalogueCard } from '@/types/product';
import { apiGet } from './api';
import { HttpError } from './request';
export const getProducts = (signal?: AbortSignal): Promise<Product[]> => apiGet('/products', { signal });
export async function getProductByHandle(handle: string, signal?: AbortSignal, fresh = false): Promise<Product | null> {
  try { return await apiGet<Product>('/products/handle/' + encodeURIComponent(handle), { signal, cache: fresh ? 'no-store' : undefined }); }
  catch (error) { if (error instanceof HttpError && error.status === 404) return null; throw error; }
}

export const cardAsProduct = (card: CatalogueCard): Product => ({ ...card, description: '' });
export function catalogueParams(filters: CatalogueFilters = {}) {
  const params = new URLSearchParams();
  Object.entries({ page: 1, pageSize: 24, sort: 'featured', ...filters }).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value));
  });
  return params;
}
export async function getCatalogue(filters: CatalogueFilters = {}, signal?: AbortSignal, fresh = false): Promise<CataloguePage> {
  const data = await apiGet<CataloguePage>('/catalog/products?' + catalogueParams(filters), { signal, cache: fresh ? 'no-store' : undefined });
  if (!Array.isArray(data.items) || !data.pagination || !Number.isInteger(data.pagination.total) ||
      !data.items.every((item) => Array.isArray(item.variants))) throw new Error('Dati catalogo non validi');
  return data;
}

// The legacy detail retains description/gallery. A separate card supplies exact variants.
// Search is a substring contract, so match both ID and handle; never use the first hit.
export async function getProductWithVariants(handle: string, signal?: AbortSignal, fresh = false): Promise<Product | null> {
  const detail = await getProductByHandle(handle, signal, fresh);
  if (!detail) return null;
  return getVariantsForProduct(detail, signal, fresh);
}
export async function getVariantsForProduct(detail: Product, signal?: AbortSignal, fresh = false): Promise<Product> {
  for (let page = 1; page <= 10; page++) {
    signal?.throwIfAborted();
    const data = await getCatalogue({ search: detail.handle, page, pageSize: 100 }, signal, fresh);
    const card = data.items.find((item) => item.id === detail.id && item.handle === detail.handle);
    if (card) return { ...detail, ...card, description: detail.description, images: detail.images, mainImage: detail.mainImage };
    if (!data.pagination.hasNext) break;
  }
  // Bounded lookup fails closed if no exact match; no representative-price fallback.
  throw new Error('Varianti non disponibili. Riprova.');
}
export const getCollections = (signal?: AbortSignal): Promise<CollectionSummary[]> => apiGet('/collections', { signal });
export async function getProductsByCollection(handle: string, signal?: AbortSignal): Promise<Product[]> {
  const data = await apiGet<{ collection: CollectionSummary; products: Product[] }>(
    '/collections/' + encodeURIComponent(handle) + '/products', { signal });
  return data.products ?? [];
}
