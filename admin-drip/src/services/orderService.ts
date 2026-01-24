import { apiGet, apiPatch } from "./api";
import type { Order, AdminOrderDetail } from "@/types";

export async function getAdminOrders(): Promise<Order[]> {
  return apiGet<Order[]>("/admin/orders");
}

export async function getAdminOrderById(id: string): Promise<AdminOrderDetail> {
  return apiGet<AdminOrderDetail>(`/admin/orders/${id}`);
}

export async function updateAdminOrder(
  id: string,
  payload: { status?: string; paymentStatus?: string },
) {
  return apiPatch(`/admin/orders/${id}`, payload);
}
