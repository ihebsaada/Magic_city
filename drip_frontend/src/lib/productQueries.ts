import { queryOptions } from "@tanstack/react-query";
import { getProducts, getProductByHandle, getVariantsForProduct, getCollections, getProductsByCollection, getCatalogue } from "@/services/productService";
import type { CatalogueFilters, Product } from '@/types/product';
import { HttpError, RequestTimeoutError } from "@/services/request";

export const catalogQueryDefaults = {
  staleTime: 60_000,
  gcTime: 5 * 60_000,
  refetchOnWindowFocus: false,
  // Offline reads fail visibly instead of leaving initial loaders paused.
  networkMode: "always" as const,
  retry: (failureCount: number, error: Error) => {
    if (error instanceof RequestTimeoutError || error.name === "AbortError") return false;
    if (error instanceof HttpError && error.status < 500) return false;
    return failureCount < 1;
  },
  retryDelay: 1_000,
};

export const productsQuery = () => queryOptions({
  ...catalogQueryDefaults, queryKey: ["products"],
  queryFn: ({ signal }) => getProducts(signal),
});
export const productQuery = (handle?: string) => queryOptions({
  ...catalogQueryDefaults, queryKey: ["product", handle], enabled: !!handle,
  queryFn: ({ signal }) => getProductByHandle(handle!, signal),
});
export const catalogueQuery = (filters: CatalogueFilters = {}, enabled = true) => queryOptions({
  ...catalogQueryDefaults, queryKey: ['catalogue-page', { page: 1, pageSize: 24, sort: 'featured', ...filters }], enabled,
  queryFn: ({ signal }) => getCatalogue(filters, signal),
});
export const productVariantsQuery = (product?: Product | null) => queryOptions({
  ...catalogQueryDefaults, queryKey: ['product-variants', product?.id, product?.handle], enabled: !!product,
  queryFn: ({ signal }) => getVariantsForProduct(product!, signal),
});
export const collectionsQuery = () => queryOptions({
  ...catalogQueryDefaults, queryKey: ["collections"],
  queryFn: ({ signal }) => getCollections(signal),
});
export const collectionProductsQuery = (handle?: string) => queryOptions({
  ...catalogQueryDefaults, queryKey: ["collection-products", handle], enabled: !!handle,
  queryFn: ({ signal }) => getProductsByCollection(handle!, signal),
});
