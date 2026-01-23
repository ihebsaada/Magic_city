import { useMutation } from "@tanstack/react-query";
import {
  createCheckoutIntentFromCart,
  CheckoutIntentResponse,
} from "@/services/orderService";
import { CartItem } from "@/contexts/CartContext";

type Customer = { name: string; email: string };

export const useCheckoutIntentFromCart = () =>
  useMutation<
    CheckoutIntentResponse,
    Error,
    { items: CartItem[]; customer: Customer; discountCode?: string }
  >({
    mutationKey: ["checkout-intent"],
    mutationFn: ({ items, customer, discountCode }) =>
      createCheckoutIntentFromCart(items, customer, discountCode),
  });
