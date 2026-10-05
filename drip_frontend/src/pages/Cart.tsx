import {rememberPaidCart} from '@/lib/paidCart';
import {navigationEnabled, navigateToCheckout, shippingEstimate} from '@/lib/navigationHandoff';
import { CheckoutHandoff } from '@/components/CheckoutHandoff';
import { prepareCommonCheckout } from '@/lib/commonCheckout';
import { Link } from "react-router-dom";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { Minus, Plus, Trash2, ShoppingBag, ArrowLeft } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";

import type { CheckoutIntentResponse } from "@/services/orderService";
import { apiPost } from "@/services/api";
import { cartFingerprint, refreshCart } from "@/lib/cartValidation";
import { selectedVariant } from '@/lib/productVariants';
import { hasPendingCheckout, loadCheckoutAttempt, newCheckoutAttempt, resumeCheckoutAttempt, checkoutPayload, checkoutErrorMessage, startDistinctPurchase, checkCheckoutTotal, confirmCheckoutTotal } from '@/lib/checkoutAttempt';

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

async function previewDiscount(subtotal: number, discountCode: string, signal?: AbortSignal) {
  return apiPost<DiscountPreviewResponse>("/discounts/preview", {
    subtotal,
    discountCode,
  }, { signal, timeoutMs: 30_000 });
}

const Cart = () => {
  const { items, removeFromCart, updateQuantity, clearCart, getCartTotal, replaceItems, updateOptions } =
    useCart();

  const [discountCode, setDiscountCode] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const checkoutInFlight = useRef(false);

  const currentItems = useRef(items);
  currentItems.current = items;
  const verification = useRef<AbortController>();
  const mounted = useRef(true);
  const [verifying, setVerifying] = useState(false);
  const [checkoutUncertain, setCheckoutUncertain] = useState(hasPendingCheckout);
  const [changes, setChanges] = useState<string[]>([]);
  const [handoffOrder, setHandoffOrder] = useState<string | null>(null);
  const [changedTotal, setChangedTotal] = useState<number | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; verification.current?.abort(); };
  }, []);

  // 🔹 Mutation React Query pour le checkout
  const { mutateAsync: checkoutIntent, isPending } = useMutation<CheckoutIntentResponse, Error, void>({
    retry: false, networkMode: "always", mutationFn: resumeCheckoutAttempt,
  });
  const [hasSavedAttempt, setHasSavedAttempt] = useState(() => {
    try { const attempt = loadCheckoutAttempt(); return !!attempt && attempt.state !== 'rejected'; } catch { return true; }
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

  const subtotal = getCartTotal();

  // ✅ live preview (debounced) -> always in sync with DB discounts
  useEffect(() => {
    const controller = new AbortController();
    const code = discountCode.trim();
    setPreview(null);
    setPreviewLoading(false);
    if (!code) return () => controller.abort();
    const timer = window.setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const result = await previewDiscount(subtotal, code, controller.signal);
        if (!controller.signal.aborted) setPreview(result);
      } catch (error) {
        if (!controller.signal.aborted) {
          setPreview({ valid: false, appliedCode: null, discountAmount: 0, total: subtotal, reason: 'ERROR' });
        }
      } finally {
        if (!controller.signal.aborted) setPreviewLoading(false);
      }
    }, 450);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [discountCode, subtotal]);

  const discountAmount = preview?.valid ? preview.discountAmount : 0;
  const appliedCode = preview?.valid ? preview.appliedCode : null;

  const finalSubtotal = Math.max(subtotal - discountAmount, 0);

  const shipping = shippingEstimate(subtotal);
  const totalWithDiscount = finalSubtotal + shipping;
  async function continueCheckout(result: CheckoutIntentResponse) {
    const controller = new AbortController();
    verification.current = controller;
    let differentTotal: number | null;
    try { differentTotal = await checkCheckoutTotal(controller.signal); }
    finally { controller.abort(); }
    if (!mounted.current) return;
    setCheckoutUncertain(false);
    if (differentTotal !== null) {
      setChangedTotal(differentTotal);
      setFormError("Il totale dell'ordine è cambiato (prezzi o sconto). Controlla e conferma il nuovo importo prima di continuare.");
      return;
    }
    setChangedTotal(null);
    const saved=loadCheckoutAttempt();
    if(saved?.cartRevision){rememberPaidCart(result.orderId,saved.body.items.map(line=>({product:{id:line.productId},quantity:line.quantity,selectedSize:line.selectedSize,selectedColor:line.selectedColor})) as typeof items,saved.cartRevision);}
    try { localStorage.setItem('lastOrderId', result.orderId); } catch { /* Credentials remain in the durable attempt. */ }
    if(navigationEnabled()){const transfer=new AbortController();verification.current=transfer;try{await navigateToCheckout(result.orderId,transfer.signal);}finally{transfer.abort();}return;}
    const commonUrl=prepareCommonCheckout(result.orderId);
    if(commonUrl){window.location.assign(commonUrl);return;}
    setHandoffOrder(result.orderId);
  }

  const handleCheckout = async () => {
    if (isPending || checkoutInFlight.current) return;

    if (hasSavedAttempt) {
      checkoutInFlight.current = true;
      try {
        const result = await checkoutIntent();
        await continueCheckout(result);
      } catch (error) {
        if (mounted.current) {
          setFormError(checkoutErrorMessage(error));
          try { const attempt = loadCheckoutAttempt(); setHasSavedAttempt(!!attempt && attempt.state !== 'rejected'); setCheckoutUncertain(hasPendingCheckout()); }
          catch { setCheckoutUncertain(true); }
        }
      } finally { checkoutInFlight.current = false; }
      return;
    }
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
    setChanges([]);
    checkoutInFlight.current = true;
    setVerifying(true);
    const controller = new AbortController();
    verification.current = controller;
    let submitted = false;

    try {
      const verified = await refreshCart(items, controller.signal);
      if (!mounted.current || controller.signal.aborted) return;
      if (cartFingerprint(items) !== cartFingerprint(currentItems.current)) {
        setFormError("Il carrello è cambiato. Verifica nuovamente prima di procedere.");
        return;
      }
      replaceItems(verified.items);
      setChanges(verified.changes);
      if (verified.errors.length || verified.changes.length) {
        setFormError(verified.errors.join(" ") || "Carrello aggiornato. Controlla le modifiche e premi nuovamente per confermare.");
        return;
      }
      const customer = {
        name: customerName.trim(),
        email: customerEmail.trim(),
      };

      // ✅ send raw code, backend will validate (and apply from DB)
      const codeToSend = discountCode.trim() ? discountCode.trim() : undefined;

      let verifiedDiscount = 0;
      if (codeToSend) {
        const checkedDiscount = await previewDiscount(verified.items.reduce((sum, item) => sum + Math.round(item.product.price * 100) * item.quantity, 0) / 100, codeToSend, controller.signal);
        if (!checkedDiscount.valid) { setFormError("Codice sconto non disponibile. Modificalo prima di confermare."); return; }
        if (!preview?.valid || preview.discountAmount !== checkedDiscount.discountAmount) {
          setPreview(checkedDiscount); setFormError("Sconto aggiornato. Controlla il totale e conferma nuovamente."); return;
        }
        verifiedDiscount = checkedDiscount.discountAmount;
      }
      controller.signal.throwIfAborted();
      if (cartFingerprint(verified.items) !== cartFingerprint(currentItems.current)) {
        setFormError("Il carrello è cambiato. Verifica nuovamente prima di procedere."); return;
      }
      newCheckoutAttempt(checkoutPayload(verified.items, customer, codeToSend, {
        name: customer.name, phone: shippingInfo.phone || undefined,
        address1: shippingInfo.address1, address2: shippingInfo.address2 || undefined,
        city: shippingInfo.city, zip: shippingInfo.zip, state: shippingInfo.state || undefined, country: shippingInfo.country,
      }), Math.max(verified.items.reduce((sum, item) => sum + Math.round(item.product.price * 100) * item.quantity, 0) / 100 - verifiedDiscount, 0) + shippingEstimate(verified.items.reduce((sum, item) => sum + Math.round(item.product.price * 100) * item.quantity, 0) / 100));
      setHasSavedAttempt(true);
      submitted = true;
      await continueCheckout(await checkoutIntent());
    } catch (e) {
      if (!mounted.current || controller.signal.aborted) return;
      if (!submitted) {
        setFormError("Impossibile verificare prezzi, disponibilità o conservare il tentativo. Nessun ordine inviato. Riprova.");
      } else {
        setFormError(checkoutErrorMessage(e));
        try { const attempt = loadCheckoutAttempt(); setHasSavedAttempt(!!attempt && attempt.state !== 'rejected'); setCheckoutUncertain(hasPendingCheckout()); }
        catch { setCheckoutUncertain(true); }
      }
    } finally {
      controller.abort();
      checkoutInFlight.current = false;
      if (mounted.current) setVerifying(false);
    }
  };

  if (items.length === 0 && !hasSavedAttempt) {
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
    <fieldset disabled={verifying || isPending} className="container mx-auto min-w-0 px-4 py-8 md:py-12">
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

      {hasSavedAttempt && <p role="status" className="mb-4 text-sm">
        Il tuo ordine e' pronto: continua con gli articoli e lo sconto gia confermati.
        Un carrello vuoto non annulla l'ordine. Nessun nuovo ordine viene creato durante la ripresa.
      </p>}
      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          {items.map((item) => {
            const invalidVariant = item.product.variants !== undefined && !selectedVariant(item.product, item.selectedSize, item.selectedColor);
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

                  <div className="flex flex-wrap gap-2 mt-2">
                    {(["size", "color"] as const).map((option) => {
                      const values = option === "size" ? item.product.sizes : item.product.colors;
                      if (!values.length) return null;
                      return <label key={option} className="text-sm">
                        {option === "size" ? "Taglia" : "Colore"}
                        <select className="ml-2 border rounded bg-background" value={(option === "size" ? item.selectedSize : item.selectedColor) ?? ""}
                          onChange={(event) => updateOptions(item.product.id, item.selectedSize, item.selectedColor,
                            option === "size" ? event.target.value || undefined : item.selectedSize,
                            option === "color" ? event.target.value || undefined : item.selectedColor)}>
                          <option value="">Seleziona</option>
                          {values.map((value) => <option key={value} value={value}>{value}</option>)}
                        </select>
                      </label>;
                    })}
                  </div>

                  <div className="flex items-center gap-2 mt-2">
                    <span className="font-semibold">
                      {invalidVariant ? 'Seleziona una combinazione valida di opzioni' : `€${item.product.price.toFixed(2)}`}
                    </span>
                    {hasDiscount && !invalidVariant && (
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

            {handoffOrder && <CheckoutHandoff orderId={handoffOrder} />}
            {changes.length > 0 && <ul role="status" className="mb-3 list-disc pl-4 text-sm">{changes.map((change) => <li key={change}>{change}</li>)}</ul>}
            {formError && (
              <p role="alert" className="text-xs text-destructive mb-3">{formError}</p>
            )}
            {changedTotal !== null && <button className="mb-3 border rounded p-3 text-sm" onClick={() => {
              try { confirmCheckoutTotal(changedTotal); setChangedTotal(null); void handleCheckout(); }
              catch (error) { setFormError(checkoutErrorMessage(error)); }
            }}>Conferma il totale di €{changedTotal.toFixed(2)} e continua</button>}
            {hasSavedAttempt && !formError && <p role="alert" className="text-xs text-destructive mb-3">Il tuo ordine e' pronto. Continua per completare l'acquisto.</p>}

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
                <span>{shipping === 0 ? "Gratuita" : `€${shipping.toFixed(2)}`}</span>
              </div>

              <div className="border-t border-border pt-3 mt-3">
                <div className="flex justify-between font-semibold text-base">
                  <span>Totale</span>
                  <span>€{totalWithDiscount.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <Button
              className="w-full mt-6"
              size="lg"
              onClick={handleCheckout}
              disabled={verifying || isPending}
            >
              {verifying ? "Verifica prezzi e disponibilità..." : isPending ? "Reindirizzamento..." : hasSavedAttempt ? "Riprendi il tuo ordine" : "Procedi al Checkout"}
            </Button>

            {hasSavedAttempt && !checkoutUncertain && <button className="mt-3 underline text-sm" onClick={() => {
              try { startDistinctPurchase(); setHasSavedAttempt(false); setFormError(null); setHandoffOrder(null); } catch (error) { setFormError(checkoutErrorMessage(error)); }
            }}>Inizia un acquisto distinto</button>}
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
    </fieldset>
  );
};

export default Cart;
