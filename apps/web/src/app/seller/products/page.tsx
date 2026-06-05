'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function SellerProductsList() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('/api/products', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setProducts(await res.json());
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = async (id: string) => {
    if (!confirm('Видалити товар? Він буде переміщений в архів.')) return;
    try {
      const token = localStorage.getItem('accessToken');
      await fetch(`/api/products/${id}/archive`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setProducts(products.filter(p => p.id !== id));
    } catch (error) {
      console.error('Помилка видалення');
    }
  };

  if (loading) return <div className="py-10 text-center text-gray-500">Завантаження...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Мої товари</h2>
        <Link
          href="/seller/products/new"
          className="bg-primary hover:bg-primary-hover text-white px-5 py-2.5 rounded-lg font-medium transition-colors shadow-sm"
        >
          + Додати товар
        </Link>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50 text-gray-500">
          <p className="mb-2">У вас ще немає доданих товарів.</p>
          <Link href="/seller/products/new" className="text-primary font-semibold hover:underline">
            Створити перший товар
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto bg-white border border-gray-200 rounded-xl shadow-sm">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-500 font-semibold tracking-wide">
            <tr>
              <th className="px-5 py-4">Фото</th>
              <th className="px-5 py-4">Назва</th>
              <th className="px-5 py-4">Категорія</th>
              <th className="px-5 py-4">Ціна</th>
              <th className="px-5 py-4">Залишок</th>
              <th className="px-5 py-4 text-center">Статус</th>
              <th className="px-5 py-4 text-right">Дії</th>
            </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
            {products.map(p => (
              <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-5 py-3">
                  <div className="w-12 h-12 bg-secondary rounded-md border border-gray-100 overflow-hidden flex items-center justify-center">
                    {p.images?.[0] ? (
                      <img src={p.images[0].url} alt={p.name} className="w-full h-full object-cover"/>
                    ) : (
                      <span className="text-[10px] font-medium text-primary">Фото</span>
                    )}
                  </div>
                </td>
                <td className="px-5 py-3 font-medium text-gray-900">{p.name}</td>
                <td className="px-5 py-3 text-gray-500">{p.category?.name}</td>
                <td className="px-5 py-3 font-semibold text-gray-900">{Number(p.price)} ₴</td>
                <td className="px-5 py-3 text-gray-700">{p.stock_qty} шт</td>
                <td className="px-5 py-3 text-center">
                  {p.status === 'ACTIVE' ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border border-success text-success bg-white">
                        Активний
                      </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border border-gray-300 text-gray-600 bg-gray-50">
                        Чернетка
                      </span>
                  )}
                </td>
                <td className="px-5 py-3 text-right">
                  <button
                    onClick={() => handleArchive(p.id)}
                    className="text-danger hover:opacity-80 font-medium text-sm transition-opacity"
                  >
                    Видалити
                  </button>
                </td>
              </tr>
            ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}