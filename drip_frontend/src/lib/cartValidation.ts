import type { CartItem } from "@/contexts/CartContext";
import type { Product } from "@/types/product";
import { getProductWithVariants } from "@/services/productService";
import { selectedVariant, variantProduct } from '@/lib/productVariants';

export function validSelection(product: Product, size?: string, color?: string, image?: string) {
  return {
    size: size && product.sizes.includes(size) ? size : undefined,
    color: color && product.colors.includes(color) ? color : undefined,
    image: image && product.images.includes(image) ? image
      : product.images.includes(product.mainImage) ? product.mainImage : product.images[0] ?? "",
  };
}

export function cartFingerprint(items: CartItem[]) { return JSON.stringify(items); }

export function mergeCartLines(items: CartItem[]): CartItem[] {
  const merged: CartItem[] = [];
  for (const item of items) {
    const existing = merged.find((line) => line.product.id === item.product.id &&
      line.selectedSize === item.selectedSize && line.selectedColor === item.selectedColor);
    if (existing) existing.quantity += item.quantity;
    else merged.push({ ...item });
  }
  return merged;
}

// Fresh reads bypass React Query and the browser HTTP cache. No POST occurs here.
export async function refreshCart(
  items: CartItem[], signal?: AbortSignal,
  readProduct = (handle: string, requestSignal?: AbortSignal) => getProductWithVariants(handle, requestSignal, true),
) {
  const handles = [...new Set(items.map((item) => item.product.handle))];
  const products = new Map(await Promise.all(handles.map(async (handle) => [handle, await readProduct(handle, signal)] as const)));
  signal?.throwIfAborted();
  const changes: string[] = [];
  const errors: string[] = [];
  const totals = new Map<number, number>();
  items.forEach((item) => totals.set(item.product.id, (totals.get(item.product.id) ?? 0) + item.quantity));
  const refreshed = items.map((item) => {
    let product = products.get(item.product.handle);
    if (!product || product.id !== item.product.id) {
      errors.push(`${item.product.title}: prodotto non disponibile. Rimuovilo dal carrello.`);
      return item;
    }
    if (!Number.isFinite(product.price) || product.price <= 0 || !Number.isFinite(product.stock) ||
      !Array.isArray(product.sizes) || !Array.isArray(product.colors) || !Array.isArray(product.images)) {
      throw new Error("Dati prodotto non validi");
    }
    const selection = validSelection(product, item.selectedSize, item.selectedColor);
    const variant = selectedVariant(product, selection.size, selection.color);
    if (product.variants !== undefined) {
      if (!variant) errors.push(`${product.title}: variante inesistente, ambigua o non supportata.`);
      else product = variantProduct(product, variant);
    }
    if (item.product.price !== product.price) changes.push(`${product.title}: prezzo aggiornato da €${item.product.price.toFixed(2)} a €${product.price.toFixed(2)}.`);
    if (item.product.stock !== product.stock) changes.push(`${product.title}: disponibilità aggiornata (${product.stock}).`);
    if (selection.size !== (item.selectedSize || undefined) || selection.color !== (item.selectedColor || undefined)) {
      changes.push(`${product.title}: variante non più disponibile.`);
    }
    if ((product.sizes.length > 0 && !selection.size) || (product.colors.length > 0 && !selection.color)) {
      errors.push(`${product.title}: seleziona una variante disponibile.`);
    }
    const variantQuantity = variant ? items.filter((line) => line.product.id === product!.id &&
      selectedVariant(product!, line.selectedSize, line.selectedColor)?.id === variant.id).reduce((sum, line) => sum + line.quantity, 0) : totals.get(product.id) ?? 0;
    if (!Number.isInteger(item.quantity) || item.quantity <= 0 || item.quantity > 99 || variantQuantity > 99 || variantQuantity > product.stock) {
      errors.push(`${product.title}: quantità non disponibile. Modifica il carrello.`);
    }
    return { ...item, product, selectedSize: selection.size, selectedColor: selection.color };
  });
  if (!items.length) errors.push("Il carrello è vuoto.");
  return { items: mergeCartLines(refreshed), changes: [...new Set(changes)], errors: [...new Set(errors)] };
}
