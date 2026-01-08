import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { Product } from "@/types/product";

export interface CartItem {
  product: Product;
  quantity: number;
  selectedSize?: string;
  selectedColor?: string;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (
    product: Product,
    quantity?: number,
    size?: string,
    color?: string
  ) => void;
  removeFromCart: (productId: number, size?: string, color?: string) => void;
  updateQuantity: (
    productId: number,
    quantity: number,
    size?: string,
    color?: string
  ) => void;
  clearCart: () => void;
  getCartTotal: () => number;
  getCartCount: () => number;
  isInCart: (productId: number, size?: string, color?: string) => boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = "magic-city-drip-cart";

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch (error) {
      console.error("[Cart] Failed to save to localStorage", error);
    }
  }, [items]);

  const sameLine = (
    item: CartItem,
    productId: number,
    size?: string,
    color?: string
  ) =>
    item.product.id === productId &&
    item.selectedSize === size &&
    item.selectedColor === color;
  const addToCart = (
    product: Product,
    quantity = 1,
    size?: string,
    color?: string
  ) => {
    setItems((prev) => {
      const existingIndex = prev.findIndex((item) =>
        sameLine(item, product.id, size, color)
      );
      if (existingIndex > -1) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + quantity,
        };
        return updated;
      }
      return [
        ...prev,
        { product, quantity, selectedSize: size, selectedColor: color },
      ];
    });
  };

  const removeFromCart = (productId: number, size?: string, color?: string) => {
    setItems((prev) =>
      prev.filter((item) => !sameLine(item, productId, size, color))
    );
  };

  const updateQuantity = (
    productId: number,
    quantity: number,
    size?: string,
    color?: string
  ) => {
    if (quantity <= 0) {
      removeFromCart(productId, size, color);
      return;
    }
    setItems((prev) =>
      prev.map((item) =>
        sameLine(item, productId, size, color) ? { ...item, quantity } : item
      )
    );
  };

  const clearCart = () => setItems([]);

  const getCartTotal = () =>
    items.reduce(
      (total, item) => total + item.product.price * item.quantity,
      0
    );

  const getCartCount = () =>
    items.reduce((count, item) => count + item.quantity, 0);

  const isInCart = (productId: number, size?: string, color?: string) =>
    items.some((item) => sameLine(item, productId, size, color));

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        getCartTotal,
        getCartCount,
        isInCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
};
