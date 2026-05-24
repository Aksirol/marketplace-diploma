'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function WishlistPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWishlist();
  }, []);

  const fetchWishlist = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      const res = await fetch('/api/users/me/wishlist', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        setItems(data);
      }
    } catch (error) {
      console.error('Помилка завантаження списку бажань:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (productId: string) => {
    try {
      const token = localStorage.getItem('accessToken');
      await fetch(`/api/users/me/wishlist/${productId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      // Оновлюємо локальний стейт
      setItems(items.filter(item => item.product_id !== productId));
    } catch (error) {
      console.error('Помилка видалення:', error);
    }
  };

  const handleAddToCart = async (productId: string) => {
    try {
      const token = localStorage.getItem('accessToken');
      await fetch('/api/cart', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Додаємо токен, якщо користувач авторизований, або працюватиме Cookie
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify({ productId, quantity: 1 })
      });
      alert('Товар додано у кошик!');
    } catch (error) {
      console.error('Помилка додавання до кошика:', error);
    }
  };

  if (loading) return <div className="text-center py-10">Завантаження...</div>;

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Список бажань</h2>

      {items.length === 0 ? (
        <div className="text-center py-12 text-gray-500 border border-dashed border-gray-300 rounded-lg">
          Ваш список бажань порожній.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item) => (
            <div key={item.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm relative group flex flex-col h-full">

              {/* Кнопка видалення */}
              <button
                onClick={() => handleRemove(item.product_id)}
                className="absolute top-2 right-2 bg-white/80 p-2 rounded-full text-gray-400 hover:text-red-500 hover:bg-white z-10 transition shadow-sm opacity-0 group-hover:opacity-100"
                title="Видалити зі списку"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd"></path></svg>
              </button>

              <div className="h-40 bg-gray-100 rounded-md mb-4 overflow-hidden relative">
                {item.product.images?.[0] && (
                  <img src={item.product.images[0].url} alt={item.product.name} className="w-full h-full object-cover" />
                )}
              </div>

              <Link href={`/store/${item.product.store_id}`} className="text-xs text-primary font-medium hover:underline mb-1">
                {item.product.store?.name}
              </Link>

              <Link href={`/product/${item.product.id}`} className="font-medium text-gray-800 hover:text-primary mb-2 line-clamp-2">
                {item.product.name}
              </Link>

              <div className="mt-auto pt-2 flex items-center justify-between">
                <span className="text-lg font-bold text-gray-900">{Number(item.product.price)} ₴</span>

                <button
                  onClick={() => handleAddToCart(item.product.id)}
                  className="bg-primary text-white p-2 rounded-md hover:bg-opacity-90 transition-colors shadow-sm"
                  title="В кошик"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}