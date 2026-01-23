import { apiPost } from "./api";
import { CartItem } from "@/contexts/CartContext";

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

export async function createCheckoutIntentFromCart(
  items: CartItem[],
  customer: { name: string; email: string },
  discountCode?: string,
  shipping?: ShippingPayload, // ✅ NEW (optional)
): Promise<CheckoutIntentResponse> {
  return apiPost<CheckoutIntentResponse>("/checkout/intent", {
    customerName: customer.name,
    customerEmail: customer.email,
    items: items.map((item) => ({
      productId: item.product.id,
      quantity: item.quantity,
      selectedSize: item.selectedSize,
      selectedColor: item.selectedColor,
    })),
    discountCode: discountCode || undefined,
    shipping: shipping || undefined, // ✅ NEW
  });
}
