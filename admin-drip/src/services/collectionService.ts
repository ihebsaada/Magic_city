// src/services/collectionService.ts
import { apiDelete, apiGet, apiPatch, apiPost } from "./api";
import type { Collection, CollectionWithProducts } from "@/types";

export async function getCollections(): Promise<Collection[]> {
  return apiGet<Collection[]>("/admin/collections");
}

export async function getCollectionProducts(
  handle: string,
): Promise<CollectionWithProducts> {
  return apiGet<CollectionWithProducts>(`/admin/collections/${handle}`);
}

// ✅ Backend: POST /admin/collections
export async function createCollection(data: {
  title: string;
  handle: string;
  description?: string | null;
}): Promise<Collection> {
  return apiPost<Collection>("/admin/collections", data);
}

// ✅ Backend: PATCH /admin/collections/:id
export async function updateCollection(
  id: number,
  data: Partial<Pick<Collection, "title" | "handle">> & {
    description?: string | null;
  },
): Promise<Collection> {
  return apiPatch<Collection>(`/admin/collections/${id}`, data);
}

// ⚠️ nécessite backend: DELETE /admin/collections/:id
export async function deleteCollection(id: number): Promise<void> {
  return apiDelete(`/admin/collections/${id}`);
}
