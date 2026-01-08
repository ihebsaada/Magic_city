// src/services/productService.ts
import { Product, CollectionSummary } from "@/types/product";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    if (res.status === 404) {
      // ts-expect-error : on gère null dans certains cas
      return null;
    }
    throw new Error(`HTTP ${res.status} on ${url}`);
  }
  return res.json() as Promise<T>;
}

// Liste de tous les produits (pour le catalogue)
export const getProducts = async (): Promise<Product[]> => {
  const data = await fetchJSON<Product[]>(`${API_URL}/products`);
  return data ?? [];
};

// Détail produit par handle (pour /product/:handle)
export const getProductByHandle = async (
  handle: string
): Promise<Product | null> => {
  const data = await fetchJSON<Product | null>(
    `${API_URL}/products/handle/${encodeURIComponent(handle)}`
  );
  return data;
};

// --- Collections ---

export const getCollections = async (): Promise<CollectionSummary[]> => {
  const data = await fetchJSON<CollectionSummary[]>(`${API_URL}/collections`);
  return data;
};

export const getProductsByCollection = async (
  collectionHandle: string
): Promise<Product[]> => {
  const data = await fetchJSON<{
    collection: { id: number; handle: string; title: string };
    products: Product[];
  }>(`${API_URL}/collections/${encodeURIComponent(collectionHandle)}/products`);

  if (!data) return [];
  return data.products ?? [];
};
