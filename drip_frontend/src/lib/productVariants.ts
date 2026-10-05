import type { Product, ProductVariant } from '@/types/product';

// Match the creation contract: unspecified options cannot disambiguate variants.
export function selectedVariant(product: Product, size?: string, color?: string): ProductVariant | undefined {
  const matches = product.variants?.filter((variant) => (!size || variant.option1 === size) && (!color || variant.option2 === color)) ?? [];
  if (matches.length !== 1 || matches[0].option3) return undefined;
  const variant = matches[0];
  return Number.isFinite(variant.price) && variant.price > 0 && Number.isInteger(variant.stock) && variant.stock >= 0 ? variant : undefined;
}
export function variantProduct(product: Product, variant: ProductVariant): Product {
  return { ...product, price: variant.price, compareAtPrice: variant.compareAtPrice,
    isOnSale: variant.compareAtPrice !== null && variant.compareAtPrice > variant.price, stock: variant.stock };
}
