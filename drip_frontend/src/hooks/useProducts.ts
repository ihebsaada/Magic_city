import { useQuery } from '@tanstack/react-query';
import { productsQuery, productQuery, collectionsQuery, collectionProductsQuery, catalogueQuery, productVariantsQuery } from '@/lib/productQueries';
import type { CatalogueFilters, Product } from '@/types/product';
export const useProducts = () => useQuery(productsQuery());
export const useProduct = (handle?: string) => useQuery(productQuery(handle));
export const useCollections = () => useQuery(collectionsQuery());
export const useProductsByCollection = (handle?: string) => useQuery(collectionProductsQuery(handle));
export const useCatalogue = (filters: CatalogueFilters = {}, enabled = true) => useQuery(catalogueQuery(filters, enabled));
export const useProductVariants = (product?: Product | null) => useQuery(productVariantsQuery(product));
