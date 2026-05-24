'use client';

import { useState } from 'react';
import { useCartStore } from '@/app/store/cart';

interface AddToCartProps {
  productId: string;
  stockQty: number;
}

export default function AddToCartButton({ productId, stockQty }: AddToCartProps) {
  const [quantity, setQuantity] = useState(1);
  const addToCart = useCartStore((state) => state.addToCart);

  const handleAdd = () => {
    addToCart(productId, quantity);
  };

  if (stockQty < 1) {
    return (
      <button disabled className="w-full bg-gray-300 text-gray-500 py-3 rounded-md font-medium cursor-not-allowed">
        Немає в наявності
      </button>
    );
  }

  return (
    <div className="flex gap-4">
      <div className="flex items-center border border-gray-300 rounded-md">
        <button
          onClick={() => setQuantity(Math.max(1, quantity - 1))}
          className="px-4 py-2 text-gray-600 hover:bg-gray-100 transition"
        >-</button>
        <span className="px-4 py-2 border-l border-r border-gray-300 font-medium">
          {quantity}
        </span>
        <button
          onClick={() => setQuantity(Math.min(stockQty, quantity + 1))}
          className="px-4 py-2 text-gray-600 hover:bg-gray-100 transition"
        >+</button>
      </div>

      <button
        onClick={handleAdd}
        className="flex-1 bg-primary text-white py-3 rounded-md font-medium hover:bg-primary-hover transition flex items-center justify-center gap-2 shadow-sm"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
        </svg>
        В кошик
      </button>
    </div>
  );
}