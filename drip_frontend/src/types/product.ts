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
}

export interface CollectionSummary {
  id: number;
  handle: string;
  title: string;
  productsCount: number;
}
