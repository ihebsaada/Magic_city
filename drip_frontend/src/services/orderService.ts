import { apiPost } from "./api";
import { CartItem } from "@/contexts/CartContext";

export async function createOrderFromCart(
  items: CartItem[],
  customer: { name: string; email: string }
) {
  const payload = {
    customerName: customer.name,
    customerEmail: customer.email,
    items: items.map((item) => ({
      productId: item.product.id,
      quantity: item.quantity,
      selectedSize: item.selectedSize,
      selectedColor: item.selectedColor,
    })),
  };

  return apiPost("/orders", payload);
}

// src/service(create checkoutService.ts)

export type CheckoutIntentResponse = {
  orderId: string;
  redirectUrl: string;
};

export async function createCheckoutIntentFromCart(
  items: CartItem[],
  customer: { name: string; email: string },
  discountCode?: string
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
    discountCode,
  });
}
