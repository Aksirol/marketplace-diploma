'use client'; // Цей компонент виконується на стороні клієнта, бо працює з подіями

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

export default function FilterBar() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Беремо поточні значення з URL або ставимо порожні
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [minPrice, setMinPrice] = useState(searchParams.get('min_price') || '');
  const [maxPrice, setMaxPrice] = useState(searchParams.get('max_price') || '');
  const [sort, setSort] = useState(searchParams.get('sort') || 'newest');

  const applyFilters = () => {
    // Створюємо новий об'єкт параметрів URL
    const params = new URLSearchParams();
    
    if (query) params.set('q', query);
    if (minPrice) params.set('min_price', minPrice);
    if (maxPrice) params.set('max_price', maxPrice);
    if (sort) params.set('sort', sort);

    // Оновлюємо URL без перезавантаження сторінки
    router.push(`/catalog?${params.toString()}`);
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6 flex flex-wrap gap-4 items-end">
      
      {/* Рядок пошуку */}
      <div className="flex-1 min-w-[200px]">
        <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">Пошук</label>
        <input 
          type="text" 
          placeholder="Назва товару..." 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full border rounded p-2 text-sm focus:ring-2 focus:ring-purple-500"
        />
      </div>

      {/* Фільтр ціни */}
      <div className="flex gap-2 min-w-[150px]">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1 uppercase">Мін. ціна</label>
          <input 
            type="number" 
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            className="w-full border rounded p-2 text-sm" placeholder="₴" 
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1 uppercase">Макс. ціна</label>
          <input 
            type="number" 
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            className="w-full border rounded p-2 text-sm" placeholder="₴" 
          />
        </div>
      </div>

      {/* Dropdown сортування */}
      <div className="min-w-[150px]">
        <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">Сортування</label>
        <select 
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="w-full border rounded p-2 text-sm bg-white"
        >
          <option value="newest">Новинки (Спочатку нові)</option>
          <option value="price_asc">Від дешевих до дорогих</option>
          <option value="price_desc">Від дорогих до дешевих</option>
          <option value="rating">За рейтингом</option>
        </select>
      </div>

      <button 
        onClick={applyFilters}
        className="bg-[#3C3489] text-white px-6 py-2 rounded font-medium hover:bg-[#26215C] transition-colors"
      >
        Застосувати
      </button>
    </div>
  );
}