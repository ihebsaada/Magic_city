import { apiDelete, apiGet, apiPatch, apiPost } from "./api";
import type { Product } from "@/types";

export type ProductCreatePayload = {
  title: string;
  handle: string;
  vendor?: string | null;
  descriptionHtml?: string | null;
  status?: "active" | "draft" | "archived" | null;
  tags?: string[];
  images?: string[]; // URLs
  collectionIds?: number[]; // ids
};

export type ProductUpdatePayload = {
  title?: string;
  handle?: string;
  vendor?: string | null;
  productType?: string | null;
  descriptionHtml?: string | null;
  status?: "active" | "draft" | "archived" | null;
  tags?: string[];
  images?: string[]; // URLs
  collectionIds?: number[];
};

export async function getProducts(search?: string): Promise<Product[]> {
  const path = search
    ? `/admin/products?search=${encodeURIComponent(search)}`
    : "/admin/products";
  return apiGet<Product[]>(path);
}

export async function getProductById(id: number): Promise<Product> {
  return apiGet<Product>(`/admin/products/${id}`);
}

export async function createProduct(
  payload: ProductCreatePayload,
): Promise<Product> {
  // backend: POST /api/admin/products
  return apiPost<Product>("/admin/products", payload);
}

export async function updateProduct(
  id: number,
  payload: ProductUpdatePayload,
): Promise<Product> {
  // backend: PATCH /api/admin/products/:id
  return apiPatch<Product>(`/admin/products/${id}`, payload);
}

export async function deleteProduct(id: number): Promise<void> {
  // backend: DELETE /api/admin/products/:id
  return apiDelete(`/admin/products/${id}`);
}
