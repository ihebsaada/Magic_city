export interface ProductImage {
  id: number;
  src: string;
  alt?: string | null;
  position?: number;
}

export interface ProductVariant {
  id: number;
  title: string | null;
  sku: string | null;
  price: string | null;
  compareAtPrice?: string | null;
  inventoryQuantity?: number | null;
  reservedQuantity?: number;
  option1?: string;
  option2?: string;
  option3?: string;
}

export interface Product {
  id: number;
  handle: string;
  title: string;
  vendor: string | null;
  productType?: string | null;
  option1Name?: string | null;
  option2Name?: string | null;
  option3Name?: string | null;
  tags?: string[];
  status?: "active" | "draft" | "archived";
  descriptionHtml?: string | null;
  images: ProductImage[];
  variants: ProductVariant[];
  createdAt?: string;
  updatedAt?: string;
  collections?: Collection[];
}

export interface Collection {
  id: number;
  handle: string;
  title: string;
  productsCount: number;
  description?: string | null;
}

export interface CollectionWithProducts {
  collection: Collection;
  products: Product[];
}

export interface Discount {
  id: string;
  code: string;
  type: "percentage" | "fixed";
  value: number;
  usageCount: number;
  reservedUses?: number;
  usageLimit?: number | null;
  expiresAt?: string | null;
  active: boolean;
}
// ✅ Liste (ok)
export interface Order {
  id: string;
  orderNumber: string; // ex "#29"
  customer: { name: string; email: string };
  total: string; // "143.91"
  status: "pending" | "processing" | "shipped" | "delivered" | "cancelled";
  paymentStatus: "pending" | "paid" | "refunded";
  createdAt: string;
  currency?: string;
}

// ✅ Détail
export interface AdminOrderItem {
  id: number;
  productId?: number | null;
  productTitle: string;
  productHandle: string;
  mainImage?: string | null;
  quantity: number;
  unitPrice: string; // "59.90"
  selectedSize?: string | null;
  selectedColor?: string | null;
  variantSku?: string | null;
}

export interface AdminOrderDetail {
  canEdit?: boolean;
  readOnlyReason?: { code: string; message: string } | null;
  allowedStatuses?: string[];
  id: string;
  orderNumber: string; // "#29"
  customer: { name: string; email: string };

  currency: string;
  total: string;

  originalTotal?: string | null;
  discountCode?: string | null;
  discountAmount?: string | null;

  status: Order["status"];
  paymentStatus: Order["paymentStatus"];

  createdAt: string;
  updatedAt: string;

  shipping: {
    name?: string | null;
    phone?: string | null;
    address1?: string | null;
    address2?: string | null;
    city?: string | null;
    zip?: string | null;
    state?: string | null;
    country?: string | null;
  };

  stripeSessionId?: string | null;
  sumupCheckoutId?: string | null;
  sumupPaymentId?: string | null;

  items: AdminOrderItem[];
}
