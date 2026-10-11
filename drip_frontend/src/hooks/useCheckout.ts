import { useMutation } from "@tanstack/react-query";
import {
  CheckoutIntentResponse,
} from "@/services/orderService";
import { CartItem } from "@/contexts/CartContext";
import { checkoutPayload, loadCheckoutAttempt, newCheckoutAttempt, resumeCheckoutAttempt } from '@/lib/checkoutAttempt';
import { refreshCart } from '@/lib/cartValidation';

type Customer = { name: string; email: string };

export const useCheckoutIntentFromCart = () =>
  useMutation<
    CheckoutIntentResponse,
    Error,
    { items: CartItem[]; customer: Customer; discountCode?: string }
  >({
    mutationKey: ["checkout-intent"],
    retry: false, networkMode: 'always',
    mutationFn: async ({ items, customer, discountCode }) => {
      const attempt = loadCheckoutAttempt();
      if (!attempt || attempt.state === 'rejected') {
        const refreshed = await refreshCart(items);
        if (refreshed.errors.length || refreshed.changes.length) throw new Error('Aggiorna e conferma il carrello prima di procedere.');
        newCheckoutAttempt(checkoutPayload(refreshed.items, customer, discountCode));
      }
      return resumeCheckoutAttempt();
    },
  });
