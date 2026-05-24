'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function OrderDetailsPage({ params }: { params: { id: string } }) {
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [canceling, setCanceling] = useState(false);

  useEffect(() => {
    fetchOrder();
  }, [params.id]);

  const fetchOrder = async () => {
    try {
      // Тут ми використовуємо вже готовий публічний ендпоінт трекінгу
      const res = await fetch(`/api/orders/track/${params.id}`);
      if (res.ok) {
        setOrder(await res.json());
      }
    } catch (error) {
      console.error('Помилка завантаження замовлення:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Ви впевнені, що хочете скасувати замовлення?')) return;
    setCanceling(true);

    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`/api/orders/${params.id}/cancel`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        alert('Замовлення успішно скасовано');
        fetchOrder(); // Оновлюємо дані
      } else {
        const data = await res.json();
        alert(data.message || 'Помилка при скасуванні');
      }
    } catch (error) {
      console.error('Помилка:', error);
    } finally {
      setCanceling(false);
    }
  };

  if (loading) return <div className="text-center py-10">Завантаження...</div>;
  if (!order) return <div className="text-center py-10">Замовлення не знайдено</div>;

  const canCancel = order.status === 'NEW' || order.status === 'PROCESSING';

  return (
    <div>
      <div className="mb-6">
        <Link href="/profile/orders" className="text-sm text-primary hover:underline mb-4 inline-block">
          ← Назад до замовлень
        </Link>
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">Замовлення № {order.id.slice(0, 8)}...</h2>
          <span className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-xs font-medium uppercase tracking-wider">
            {order.status}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
          <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">Продавець</h3>
          <p className="font-medium text-gray-900">{order.store.name}</p>
          <p className="text-sm text-gray-600">{order.store.location || 'Локацію не вказано'}</p>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
          <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">Доставка</h3>
          <p className="font-medium text-gray-900">{order.delivery_method}</p>
          <p className="text-sm text-gray-600">{order.address?.city}, {order.address?.street}</p>
          {order.tracking_number && (
            <p className="text-sm text-primary mt-1 font-medium">ТТН: {order.tracking_number}</p>
          )}
        </div>

        <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
          <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">Оплата</h3>
          <p className="font-medium text-gray-900">{order.payment_method}</p>
          <p className="text-sm text-gray-600">Статус: {order.payment_status}</p>
        </div>
      </div>

      <h3 className="text-lg font-bold mb-4">Товари</h3>
      <div className="border border-gray-200 rounded-lg overflow-hidden mb-6">
        <table className="w-full text-left text-sm text-gray-600">
          <thead className="bg-gray-50 border-b border-gray-200 uppercase text-xs text-gray-500">
          <tr>
            <th className="px-4 py-3">Товар</th>
            <th className="px-4 py-3 text-center">Ціна</th>
            <th className="px-4 py-3 text-center">К-сть</th>
            <th className="px-4 py-3 text-right">Сума</th>
          </tr>
          </thead>
          <tbody>
          {order.items.map((item: any) => (
            <tr key={item.id} className="border-b border-gray-100 last:border-0">
              <td className="px-4 py-4 flex items-center gap-3">
                <div className="w-12 h-12 bg-gray-100 rounded flex-shrink-0 overflow-hidden">
                  {item.product.images?.[0] && <img src={item.product.images[0].url} alt="" className="w-full h-full object-cover" />}
                </div>
                <span className="font-medium text-gray-900">{item.product.name}</span>
              </td>
              <td className="px-4 py-4 text-center">{Number(item.unit_price)} ₴</td>
              <td className="px-4 py-4 text-center">{item.quantity} шт</td>
              <td className="px-4 py-4 text-right font-medium text-gray-900">{Number(item.unit_price) * item.quantity} ₴</td>
            </tr>
          ))}
          </tbody>
        </table>

        <div className="bg-gray-50 px-4 py-4 border-t border-gray-200 flex justify-between items-center">
          <span className="font-bold text-gray-700">Всього до оплати:</span>
          <span className="text-xl font-bold text-gray-900">{Number(order.total_amount)} ₴</span>
        </div>
      </div>

      {canCancel && (
        <div className="flex justify-end">
          <button
            onClick={handleCancel}
            disabled={canceling}
            className="px-6 py-2 border border-red-200 text-red-600 rounded-md font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            {canceling ? 'Скасування...' : 'Скасувати замовлення'}
          </button>
        </div>
      )}
    </div>
  );
}