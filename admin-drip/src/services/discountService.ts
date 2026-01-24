// src/services/discountService.ts
import { apiGet, apiPost, apiPatch, apiDelete } from "./api";
import type { Discount } from "@/types";

export async function getAdminDiscounts(): Promise<Discount[]> {
  return apiGet<Discount[]>("/admin/discounts");
}

export type CreateDiscountPayload = {
  code: string;
  type: "percentage" | "fixed";
  value: number;
  usageLimit?: number | null;
  expiresAt?: string | null; // ISO string
  active?: boolean;
};

export async function createAdminDiscount(payload: CreateDiscountPayload) {
  return apiPost("/admin/discounts", payload);
}

export type UpdateDiscountPayload = Partial<CreateDiscountPayload>;

export async function updateAdminDiscount(
  id: string,
  payload: UpdateDiscountPayload,
) {
  return apiPatch(`/admin/discounts/${id}`, payload);
}

export async function deleteAdminDiscount(id: string) {
  return apiDelete(`/admin/discounts/${id}`);
}
