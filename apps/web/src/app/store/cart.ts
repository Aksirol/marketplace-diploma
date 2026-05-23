import { create } from 'zustand';
import axios from 'axios';

// Налаштовуємо axios для передачі cookies
const api = axios.create({
  baseURL: '/api',
  withCredentials: true, 
});

interface CartItem {
  productId: string;
  quantity: number;
  product?: any; // Збагачені дані з бекенду
}

interface CartState {
  items: CartItem[];
  isOpen: boolean;
  toggleCart: () => void;
  fetchCart: () => Promise<void>;
  addToCart: (productId: string, quantity?: number) => Promise<void>;
  removeFromCart: (productId: string) => Promise<void>;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  isOpen: false,

  toggleCart: () => set((state) => ({ isOpen: !state.isOpen })),

  fetchCart: async () => {
    try {
      const response = await api.get('/cart');
      set({ items: response.data.items });
    } catch (error) {
      console.error('Помилка завантаження кошика', error);
    }
  },

  addToCart: async (productId, quantity = 1) => {
    try {
      await api.post('/cart', { productId, quantity });
      get().fetchCart(); // Оновлюємо кошик після додавання
      set({ isOpen: true }); // Автоматично відкриваємо сайдбар
    } catch (error) {
      alert((error as any).response?.data?.message || 'Помилка');
    }
  },

  removeFromCart: async (productId) => {
    try {
      await api.delete(`/cart/${productId}`);
      get().fetchCart();
    } catch (error) {
      console.error(error);
    }
  },
}));