// src/pages/Cart.tsx
import { Link } from "react-router-dom";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { Minus, Plus, Trash2, ShoppingBag, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  createCheckoutIntentFromCart,
  type CheckoutIntentResponse,
} from "@/services/orderService";
import type { CartItem } from "@/contexts/CartContext";

// 💸 Même logique de remise que le backend (MAGIC10 = -10%, MAGIC5 = -5€)
const DISCOUNT_CODES: Record<
  string,
  { type: "percent" | "fixed"; value: number }
> = {
  MAGIC10: { type: "percent", value: 10 },
  MAGIC5: { type: "fixed", value: 5 },
};

function computeDiscountPreview(subtotal: number, code: string) {
  const raw = (code ?? "").trim();
  if (!raw) {
    return {
      discountAmount: 0,
      finalSubtotal: subtotal,
      appliedCode: undefined as string | undefined,
      isValid: false,
    };
  }

  const normalized = raw.toUpperCase();
  const rule = DISCOUNT_CODES[normalized];

  if (!rule) {
    return {
      discountAmount: 0,
      finalSubtotal: subtotal,
      appliedCode: undefined,
      isValid: false,
    };
  }

  const discountAmount =
    rule.type === "percent" ? (subtotal * rule.value) / 100 : rule.value;

  const finalSubtotal = Math.max(subtotal - discountAmount, 0);

  return {
    discountAmount,
    finalSubtotal,
    appliedCode: normalized,
    isValid: true,
  };
}

const Cart = () => {
  const { items, removeFromCart, updateQuantity, clearCart, getCartTotal } =
    useCart();

  const [discountCode, setDiscountCode] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // 🔹 Mutation React Query pour le checkout
  const { mutateAsync: checkoutIntent, isPending } = useMutation<
    CheckoutIntentResponse,
    Error,
    {
      items: CartItem[];
      customer: { name: string; email: string };
      discountCode?: string;
    }
  >({
    mutationFn: ({ items, customer, discountCode }) =>
      createCheckoutIntentFromCart(items, customer, discountCode),
  });

  const handleCheckout = async () => {
    // 🔎 simple validation côté client
    if (!customerName.trim() || !customerEmail.trim()) {
      setFormError("Per favore inserisci nome ed email.");
      return;
    }

    // validation email très simple
    const emailOk = customerEmail.includes("@") && customerEmail.includes(".");
    if (!emailOk) {
      setFormError("Per favore inserisci un indirizzo email valido.");
      return;
    }

    setFormError(null);

    try {
      const customer = {
        name: customerName.trim(),
        email: customerEmail.trim(),
      };

      const { orderId, redirectUrl } = await checkoutIntent({
        items,
        customer,
        discountCode: discountCode || undefined,
      });

      localStorage.setItem("lastOrderId", orderId);
      window.location.href = redirectUrl;
    } catch (e) {
      console.error(e);
      alert("Checkout failed. Check console.");
    }
  };

  if (items.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
        <ShoppingBag className="h-16 w-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-serif font-semibold mb-2">
          Il tuo carrello è vuoto
        </h1>
        <p className="text-muted-foreground mb-6 text-center">
          Non hai ancora aggiunto prodotti al carrello.
        </p>
        <Button asChild>
          <Link to="/catalog">Scopri il Catalogo</Link>
        </Button>
      </div>
    );
  }

  // 🧮 Calculs pour le résumé
  const subtotal = getCartTotal();
  const { discountAmount, finalSubtotal, appliedCode, isValid } =
    computeDiscountPreview(subtotal, discountCode);

  // On garde ta logique actuelle de shipping : basée sur le subtotal
  const shipping = subtotal >= 99.9 ? 0 : 9.9;
  const totalWithDiscount = finalSubtotal + shipping;

  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-serif font-semibold">
            Carrello
          </h1>
          <p className="text-muted-foreground mt-1">
            {items.length} {items.length === 1 ? "articolo" : "articoli"}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={clearCart}>
          <Trash2 className="h-4 w-4 mr-2" />
          Svuota carrello
        </Button>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Cart Items */}
        <div className="lg:col-span-2 space-y-4">
          {items.map((item) => {
            const hasDiscount =
              item.product.compareAtPrice &&
              item.product.compareAtPrice > item.product.price;

            return (
              <div
                key={`${item.product.id}-${item.selectedSize ?? "nosize"}-${
                  item.selectedColor ?? "nocolor"
                }`}
                className="flex gap-4 p-4 border border-border rounded-lg bg-card"
              >
                {/* Image */}
                <Link
                  to={`/product/${item.product.handle}`}
                  className="shrink-0"
                >
                  <img
                    src={item.product.mainImage}
                    alt={item.product.title}
                    className="w-24 h-24 md:w-32 md:h-32 object-cover rounded-md"
                  />
                </Link>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <Link
                    to={`/product/${item.product.handle}`}
                    className="hover:text-accent transition-colors"
                  >
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {item.product.brand}
                    </p>
                    <h3 className="font-medium line-clamp-2 mt-1">
                      {item.product.title}
                    </h3>
                  </Link>

                  {/* Size & Color */}
                  {(item.selectedSize || item.selectedColor) && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {item.selectedSize && `Taglia: ${item.selectedSize}`}
                      {item.selectedSize && item.selectedColor && " · "}
                      {item.selectedColor && `Colore: ${item.selectedColor}`}
                    </p>
                  )}

                  {/* Price */}
                  <div className="flex items-center gap-2 mt-2">
                    <span className="font-semibold">
                      €{item.product.price.toFixed(2)}
                    </span>
                    {hasDiscount && (
                      <span className="text-sm text-muted-foreground line-through">
                        €{item.product.compareAtPrice!.toFixed(2)}
                      </span>
                    )}
                  </div>

                  {/* Quantity & Remove */}
                  <div className="flex items-center justify-between mt-4">
                    <div className="flex items-center border border-border rounded-md">
                      <button
                        onClick={() =>
                          updateQuantity(
                            item.product.id,
                            item.quantity - 1,
                            item.selectedSize,
                            item.selectedColor
                          )
                        }
                        className="p-2 hover:bg-muted transition-colors"
                        aria-label="Diminuisci quantità"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="px-4 py-2 min-w-[3rem] text-center font-medium">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() =>
                          updateQuantity(
                            item.product.id,
                            item.quantity + 1,
                            item.selectedSize,
                            item.selectedColor
                          )
                        }
                        className="p-2 hover:bg-muted transition-colors"
                        aria-label="Aumenta quantità"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    <button
                      onClick={() =>
                        removeFromCart(
                          item.product.id,
                          item.selectedSize,
                          item.selectedColor
                        )
                      }
                      className="p-2 text-muted-foreground hover:text-destructive transition-colors"
                      aria-label="Rimuovi dal carrello"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <div className="border border-border rounded-lg p-6 bg-card sticky top-24">
            <h2 className="text-xl font-serif font-semibold mb-4">
              Riepilogo Ordine
            </h2>

            {/* 🧍‍♂️ Customer info */}
            <div className="space-y-3 mb-5">
              <div>
                <label className="text-sm font-medium" htmlFor="customerName">
                  Nome completo
                </label>
                <input
                  id="customerName"
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Es. Mario Rossi"
                  className="mt-1 w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium" htmlFor="customerEmail">
                  Email
                </label>
                <input
                  id="customerEmail"
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="nome@email.com"
                  className="mt-1 w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
                />
              </div>
            </div>

            {/* 🔹 Discount code input */}
            <div className="mb-4">
              <label className="text-sm font-medium">Codice sconto</label>
              <input
                type="text"
                value={discountCode}
                onChange={(e) => setDiscountCode(e.target.value)}
                placeholder="MAGIC10"
                className="mt-2 w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
              />
              {discountCode && !isValid && (
                <p className="text-xs text-destructive mt-1">
                  Codice non valido. Il totale resterà invariato.
                </p>
              )}
              {appliedCode && (
                <p className="text-xs text-emerald-600 mt-1">
                  Codice {appliedCode} verrà applicato al checkout.
                </p>
              )}
            </div>

            {formError && (
              <p className="text-xs text-destructive mb-3">{formError}</p>
            )}

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotale</span>
                <span>€{subtotal.toFixed(2)}</span>
              </div>

              {discountAmount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Sconto {appliedCode}</span>
                  <span>-€{discountAmount.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between">
                <span className="text-muted-foreground">Spedizione</span>
                <span>{shipping === 0 ? "Gratuita" : "€9,90"}</span>
              </div>

              <div className="border-t border-border pt-3 mt-3">
                <div className="flex justify-between font-semibold text-base">
                  <span>Totale</span>
                  <span>€{totalWithDiscount.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {subtotal < 99.9 && (
              <p className="text-xs text-muted-foreground mt-4 text-center">
                Aggiungi €{(99.9 - subtotal).toFixed(2)} per la spedizione
                gratuita
              </p>
            )}

            <Button
              className="w-full mt-6"
              size="lg"
              onClick={handleCheckout}
              disabled={isPending}
            >
              {isPending ? "Reindirizzamento..." : "Procedi al Checkout"}
            </Button>

            <Link
              to="/catalog"
              className="flex items-center justify-center gap-2 mt-4 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Continua lo shopping
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cart;
