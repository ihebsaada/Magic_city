import { Link } from "react-router-dom";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { Minus, Plus, Trash2, ShoppingBag, ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";

import {
  createCheckoutIntentFromCart,
  type CheckoutIntentResponse,
  type ShippingPayload,
} from "@/services/orderService";

import type { CartItem } from "@/contexts/CartContext";
import { apiPost } from "@/services/api";

// ✅ preview endpoint response (backend: POST /discounts/preview)
type DiscountPreviewResponse = {
  valid: boolean;
  appliedCode: string | null;
  discountAmount: number;
  total: number;
  reason?:
    | "EMPTY"
    | "NOT_FOUND"
    | "INACTIVE"
    | "EXPIRED"
    | "LIMIT_REACHED"
    | "ERROR"
    | null;
};

async function previewDiscount(subtotal: number, discountCode: string) {
  return apiPost<DiscountPreviewResponse>("/discounts/preview", {
    subtotal,
    discountCode,
  });
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
      shipping?: ShippingPayload;
    }
  >({
    mutationFn: ({ items, customer, discountCode, shipping }) =>
      createCheckoutIntentFromCart(items, customer, discountCode, shipping),
  });

  // ✅ discount preview from backend
  const [previewLoading, setPreviewLoading] = useState(false);
  const [preview, setPreview] = useState<DiscountPreviewResponse | null>(null);

  // ✅ tous les champs vides (le client remplit)
  const [shippingInfo, setShippingInfo] = useState({
    phone: "",
    address1: "",
    address2: "",
    city: "",
    zip: "",
    state: "",
    country: "",
  });

  const subtotal = useMemo(() => getCartTotal(), [getCartTotal, items]);

  // ✅ live preview (debounced) -> always in sync with DB discounts
  useEffect(() => {
    const code = discountCode.trim();

    if (!code) {
      setPreview(null);
      return;
    }

    const t = window.setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const r = await previewDiscount(subtotal, code);
        setPreview(r);
      } catch (e) {
        console.error(e);
        setPreview({
          valid: false,
          appliedCode: null,
          discountAmount: 0,
          total: subtotal,
          reason: "ERROR",
        });
      } finally {
        setPreviewLoading(false);
      }
    }, 450);

    return () => window.clearTimeout(t);
  }, [discountCode, subtotal]);

  const discountAmount = preview?.valid ? preview.discountAmount : 0;
  const appliedCode = preview?.valid ? preview.appliedCode : null;

  const finalSubtotal = Math.max(subtotal - discountAmount, 0);

  const shipping = subtotal >= 99.9 ? 0 : 9.9;
  const totalWithDiscount = finalSubtotal + shipping;

  const handleCheckout = async () => {
    // 🔎 simple validation côté client
    if (!customerName.trim() || !customerEmail.trim()) {
      setFormError("Per favore inserisci nome ed email.");
      return;
    }

    const emailOk = customerEmail.includes("@") && customerEmail.includes(".");
    if (!emailOk) {
      setFormError("Per favore inserisci un indirizzo email valido.");
      return;
    }

    // ✅ shipping minimal
    if (
      !shippingInfo.address1.trim() ||
      !shippingInfo.city.trim() ||
      !shippingInfo.zip.trim() ||
      !shippingInfo.country.trim()
    ) {
      setFormError("Per favore inserisci indirizzo, città, CAP e paese.");
      return;
    }

    setFormError(null);

    try {
      const customer = {
        name: customerName.trim(),
        email: customerEmail.trim(),
      };

      // ✅ send raw code, backend will validate (and apply from DB)
      const codeToSend = discountCode.trim() ? discountCode.trim() : undefined;

      const { orderId, redirectUrl } = await createCheckoutIntentFromCart(
        items,
        customer,
        codeToSend,
        {
          name: customer.name,
          phone: shippingInfo.phone || undefined,
          address1: shippingInfo.address1 || undefined,
          address2: shippingInfo.address2 || undefined,
          city: shippingInfo.city || undefined,
          zip: shippingInfo.zip || undefined,
          state: shippingInfo.state || undefined,
          country: shippingInfo.country || undefined,
        },
      );

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

  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
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
        <div className="lg:col-span-2 space-y-4">
          {items.map((item) => {
            const hasDiscount =
              item.product.compareAtPrice &&
              item.product.compareAtPrice > item.product.price;

            return (
              <div
                key={`${item.product.id}-${item.selectedSize ?? "nosize"}-${item.selectedColor ?? "nocolor"}`}
                className="flex gap-4 p-4 border border-border rounded-lg bg-card"
              >
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

                  {(item.selectedSize || item.selectedColor) && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {item.selectedSize && `Taglia: ${item.selectedSize}`}
                      {item.selectedSize && item.selectedColor && " · "}
                      {item.selectedColor && `Colore: ${item.selectedColor}`}
                    </p>
                  )}

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

                  <div className="flex items-center justify-between mt-4">
                    <div className="flex items-center border border-border rounded-md">
                      <button
                        onClick={() =>
                          updateQuantity(
                            item.product.id,
                            item.quantity - 1,
                            item.selectedSize,
                            item.selectedColor,
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
                            item.selectedColor,
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
                          item.selectedColor,
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

        <div className="lg:col-span-1">
          <div className="border border-border rounded-lg p-6 bg-card sticky top-24">
            <h2 className="text-xl font-serif font-semibold mb-4">
              Riepilogo Ordine
            </h2>

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

            {/* 📦 Shipping info */}
            <div className="space-y-3 mt-4">
              <div>
                <label className="text-sm font-medium">Indirizzo</label>
                <input
                  type="text"
                  value={shippingInfo.address1}
                  onChange={(e) =>
                    setShippingInfo((s) => ({ ...s, address1: e.target.value }))
                  }
                  placeholder="Via ... Numero ..."
                  className="mt-1 w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
                />
              </div>

              <div>
                <label className="text-sm font-medium">
                  Indirizzo 2 (opzionale)
                </label>
                <input
                  type="text"
                  value={shippingInfo.address2}
                  onChange={(e) =>
                    setShippingInfo((s) => ({ ...s, address2: e.target.value }))
                  }
                  placeholder="Appartamento, Scala, ..."
                  className="mt-1 w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-sm font-medium">Città</label>
                  <input
                    type="text"
                    value={shippingInfo.city}
                    onChange={(e) =>
                      setShippingInfo((s) => ({ ...s, city: e.target.value }))
                    }
                    placeholder="Milano"
                    className="mt-1 w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">CAP</label>
                  <input
                    type="text"
                    value={shippingInfo.zip}
                    onChange={(e) =>
                      setShippingInfo((s) => ({ ...s, zip: e.target.value }))
                    }
                    placeholder="20100"
                    className="mt-1 w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-sm font-medium">
                    Stato (opzionale)
                  </label>
                  <input
                    type="text"
                    value={shippingInfo.state}
                    onChange={(e) =>
                      setShippingInfo((s) => ({ ...s, state: e.target.value }))
                    }
                    placeholder="Lombardia"
                    className="mt-1 w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Paese</label>
                  <input
                    type="text"
                    value={shippingInfo.country}
                    onChange={(e) =>
                      setShippingInfo((s) => ({
                        ...s,
                        country: e.target.value,
                      }))
                    }
                    placeholder="Italy"
                    className="mt-1 w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">
                  Telefono (opzionale)
                </label>
                <input
                  type="text"
                  value={shippingInfo.phone}
                  onChange={(e) =>
                    setShippingInfo((s) => ({ ...s, phone: e.target.value }))
                  }
                  placeholder="+39 ..."
                  className="mt-1 w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
                />
              </div>
            </div>

            {/* 🔹 Discount code input (DB preview) */}
            <div className="mb-4 mt-4">
              <label className="text-sm font-medium">Codice sconto</label>
              <input
                type="text"
                value={discountCode}
                onChange={(e) => setDiscountCode(e.target.value)}
                placeholder="MAGIC00"
                className="mt-2 w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
              />

              {previewLoading && (
                <p className="text-xs text-muted-foreground mt-1">
                  Verifica del codice...
                </p>
              )}

              {!previewLoading &&
                discountCode.trim() &&
                preview?.valid === false && (
                  <p className="text-xs text-destructive mt-1">
                    Codice non valido. Il totale resterà invariato.
                  </p>
                )}

              {!previewLoading && preview?.valid && appliedCode && (
                <p className="text-xs text-emerald-600 mt-1">
                  Codice {appliedCode} applicato (-€{discountAmount.toFixed(2)}
                  ).
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
