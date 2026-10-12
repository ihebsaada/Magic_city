import {
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
  apiPut,
  errorMessage,
} from "./api";
import type { Product, ProductVariant, Collection } from "@/types";

export type ProductMutationResult = Omit<Product, "collections"> & {
  collections?: {
    productId: number;
    collectionId: number;
    collection: Omit<Collection, "productsCount">;
  }[];
};

export type ProductCreatePayload = {
  title: string;
  handle: string;
  vendor?: string | null;
  descriptionHtml?: string | null;
  status?: "active" | "draft" | "archived" | null;
  tags?: string[];
  images?: string[];
  collectionIds?: number[];

  // ✅ required to create default variant
  price: number;
  compareAtPrice?: number | null;
  inventoryQuantity?: number | null;
  sku?: string | null;

  // ✅ optional (since you already added in backend)
  productType?: string | null;
  option1Name?: string | null;
  option2Name?: string | null;
  option3Name?: string | null;
};

export type ProductUpdatePayload = {
  option1Name?: string | null;
  option2Name?: string | null;
  option3Name?: string | null;
  variantUpdate?: DefaultVariantUpdatePayload;
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
): Promise<ProductMutationResult> {
  // backend: POST /api/admin/products
  return apiPost<ProductMutationResult>("/admin/products", payload);
}

export async function updateProduct(
  id: number,
  payload: ProductUpdatePayload,
): Promise<ProductMutationResult> {
  // backend: PATCH /api/admin/products/:id
  return apiPatch<ProductMutationResult>(`/admin/products/${id}`, payload);
}

export async function deleteProduct(id: number): Promise<void> {
  // backend: DELETE /api/admin/products/:id
  return apiDelete(`/admin/products/${id}`);
}
export type DefaultVariantUpdatePayload = {
  variantId?: number;
  price?: number;
  compareAtPrice?: number | null;
  inventoryQuantity?: number | null;
  sku?: string | null;
};

export async function updateDefaultVariant(
  productId: number,
  payload: DefaultVariantUpdatePayload,
) {
  // backend: PATCH /api/admin/products/:id/default-variant
  return apiPatch<ProductVariant>(
    `/admin/products/${productId}/default-variant`,
    payload,
  );
}

export async function saveProductChanges(
  id: number,
  payload: ProductUpdatePayload,
  previousCollectionIds: number[],
) {
  const { collectionIds, ...fields } = payload;
  const changed =
    collectionIds !== undefined &&
    JSON.stringify([...collectionIds].sort((a, b) => a - b)) !==
      JSON.stringify([...previousCollectionIds].sort((a, b) => a - b));
  if (Object.keys(fields).length) await updateProduct(id, fields);
  if (changed) {
    try {
      await apiPut<{ ok: true }>(`/admin/products/${id}/collections`, {
        collectionIds,
      });
    } catch (error) {
      throw new Error(
        (Object.keys(fields).length
          ? "Product and selected variant saved, but collections were not saved. "
          : "Collections were not saved. ") +
          errorMessage(error) +
          " Reload before retrying.",
      );
    }
  }
}
