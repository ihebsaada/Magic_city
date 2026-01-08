import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { Product } from "@/types/product";

interface WishlistContextType {
  items: Product[];
  addToWishlist: (product: Product) => void;
  removeFromWishlist: (productId: number) => void;
  toggleWishlist: (product: Product) => void;
  isInWishlist: (productId: number) => boolean;
  clearWishlist: () => void;
}

const WishlistContext = createContext<WishlistContextType | undefined>(
  undefined
);

const WISHLIST_STORAGE_KEY = "magic-city-drip-wishlist";

export const WishlistProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<Product[]>(() => {
    if (typeof window === "undefined") return [];
    const stored = localStorage.getItem(WISHLIST_STORAGE_KEY);
    try {
      return stored ? (JSON.parse(stored) as Product[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(items));
    } catch (error) {
      console.error("[Wishlist] Failed to save to localStorage", error);
    }
  }, [items]);

  const addToWishlist = (product: Product) => {
    setItems((prev) => {
      if (prev.some((item) => item.id === product.id)) return prev;
      return [...prev, product];
    });
  };

  const removeFromWishlist = (productId: number) => {
    setItems((prev) => prev.filter((item) => item.id !== productId));
  };

  const isInWishlist = (productId: number) =>
    items.some((item) => item.id === productId);

  const toggleWishlist = (product: Product) => {
    if (isInWishlist(product.id)) {
      removeFromWishlist(product.id);
    } else {
      addToWishlist(product);
    }
  };

  const clearWishlist = () => setItems([]);

  return (
    <WishlistContext.Provider
      value={{
        items,
        addToWishlist,
        removeFromWishlist,
        toggleWishlist,
        isInWishlist,
        clearWishlist,
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlist = () => {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error("useWishlist must be used within a WishlistProvider");
  }
  return context;
};
