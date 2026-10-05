import { apiPost } from "./api";
import { CartItem } from "@/contexts/CartContext";
import { apiGet } from './api';
import type { RequestOptions } from './request';

export type CheckoutIntentResponse = {
  orderId: string;
  redirectUrl: string;
};

export type ShippingPayload = {
  name?: string;
  phone?: string;
  address1?: string;
  address2?: string;
  city?: string;
  zip?: string;
  state?: string;
  country?: string;
};
export type CheckoutPayload = {
  customerName: string; customerEmail: string;
  items: { productId: number; quantity: number; selectedSize?: string; selectedColor?: string }[];
  discountCode?: string; shipping?: ShippingPayload;
};
export function checkoutPayload(items: CartItem[], customer: { name: string; email: string }, discountCode?: string, shipping?: ShippingPayload): CheckoutPayload {
  return { customerName: customer.name, customerEmail: customer.email,
    items: items.map((item) => ({ productId: item.product.id, quantity: item.quantity,
      selectedSize: item.selectedSize, selectedColor: item.selectedColor })), discountCode: discountCode || undefined, shipping };
}
export const prepareOrderAccess = () => apiPost<{ accessToken: string; expiresAt: string }>('/order-access/prepare', {}, { cache: 'no-store', timeoutMs: 15_000 });
export const submitCheckoutPayload = (body: CheckoutPayload, options?: RequestOptions) => apiPost<CheckoutIntentResponse>('/checkout/intent', body, { cache: 'no-store', ...options });
export const readOrderMinimal = (orderId: string, accessToken: string, signal?: AbortSignal) => apiGet<{ paymentStatus: string; total: number; currency: string }>('/orders/' + encodeURIComponent(orderId) + '/min',
  { signal, cache: 'no-store', headers: { 'Order-Access-Token': accessToken } });

export async function createCheckoutIntentFromCart(
  items: CartItem[],
  customer: { name: string; email: string },
  discountCode?: string,
  shipping?: ShippingPayload, // ✅ NEW (optional)
): Promise<CheckoutIntentResponse> {
  return submitCheckoutPayload(checkoutPayload(items, customer, discountCode, shipping));
}
