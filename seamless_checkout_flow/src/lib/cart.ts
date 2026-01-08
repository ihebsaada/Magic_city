export interface CartItem {
  id: string;
  name: string;
  genericName: string;
  description: string;
  price: number;
  quantity: number;
}

const CART_KEY = 'checkout_cart';
const SESSION_KEY = 'checkout_session_id';

// Simple encryption for demo purposes (in production, use proper encryption)
const encryptCart = (cart: CartItem[]): string => {
  return btoa(JSON.stringify(cart));
};

const decryptCart = (encrypted: string): CartItem[] => {
  try {
    return JSON.parse(atob(encrypted));
  } catch {
    return [];
  }
};

export const getSessionId = (): string => {
  let sessionId = sessionStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, sessionId);
  }
  return sessionId;
};

export const getCart = (): CartItem[] => {
  const encrypted = sessionStorage.getItem(CART_KEY);
  if (!encrypted) return [];
  return decryptCart(encrypted);
};

export const saveCart = (cart: CartItem[]): void => {
  const encrypted = encryptCart(cart);
  sessionStorage.setItem(CART_KEY, encrypted);
};

export const addToCart = (item: Omit<CartItem, 'genericName'>): void => {
  const cart = getCart();
  const existingIndex = cart.findIndex(i => i.id === item.id);
  
  const genericName = `Item ${cart.length + 1}`;
  
  if (existingIndex >= 0) {
    cart[existingIndex].quantity += item.quantity;
  } else {
    cart.push({ ...item, genericName });
  }
  
  saveCart(cart);
};

export const removeFromCart = (itemId: string): void => {
  const cart = getCart().filter(item => item.id !== itemId);
  saveCart(cart);
};

export const updateQuantity = (itemId: string, quantity: number): void => {
  const cart = getCart();
  const item = cart.find(i => i.id === itemId);
  if (item) {
    item.quantity = Math.max(0, quantity);
    if (item.quantity === 0) {
      removeFromCart(itemId);
    } else {
      saveCart(cart);
    }
  }
};

export const clearCart = (): void => {
  sessionStorage.removeItem(CART_KEY);
};

export const getCartTotal = (): number => {
  return getCart().reduce((total, item) => total + item.price * item.quantity, 0);
};

export const getEncryptedCart = (): string => {
  return sessionStorage.getItem(CART_KEY) || '';
};

// Demo items to populate cart
export const demoItems: Omit<CartItem, 'genericName'>[] = [
  { id: '1', name: 'Premium Widget', description: 'High-quality product', price: 2999, quantity: 1 },
  { id: '2', name: 'Standard Package', description: 'Essential bundle', price: 1499, quantity: 2 },
  { id: '3', name: 'Pro Service', description: 'Professional service', price: 4999, quantity: 1 },
];
