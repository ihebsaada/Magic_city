// src/types/product.ts

export interface Product {
  id: number;
  handle: string;
  title: string;

  // images
  mainImage: string;
  images: string[];

  // prix
  price: number;
  compareAtPrice?: number | null;

  // flags marketing
  isNew?: boolean;
  isOnSale?: boolean;

  // infos produit
  brand: string;
  description: string;
  collection: string; // handle de la collection (sneakers, felpa, ...)

  // 🔹 NOMS des options venant de Shopify
  // ex: "Taglia", "Size", "Colore", "Color", etc.
  option1Name?: string | null;
  option2Name?: string | null;
  option3Name?: string | null;

  // variantes (valeurs dérivées des variants Shopify)
  colors: string[];
  sizes: string[];
  stock: number;
  variants?: ProductVariant[];
}

export interface ProductVariant {
  id: number;
  sku: string | null;
  price: number;
  compareAtPrice: number | null;
  option1: string | null;
  option2: string | null;
  option3: string | null;
  stock: number;
}
export type CatalogueCard = Omit<Product, 'description' | 'variants'> & { variants: ProductVariant[] };
export type CatalogueSort = 'featured' | 'id-asc' | 'id-desc' | 'name' | 'name-desc' | 'price-asc' | 'price-desc';
export interface CatalogueFilters {
  page?: number; pageSize?: number; search?: string; vendor?: string; collection?: string;
  size?: string; color?: string; inStock?: boolean; sale?: boolean;
  minPrice?: string; maxPrice?: string; sort?: CatalogueSort;
}
export interface CataloguePage {
  items: CatalogueCard[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number; hasNext: boolean };
}

export interface CollectionSummary {
  id: number;
  handle: string;
  title: string;
  productsCount: number;
}
