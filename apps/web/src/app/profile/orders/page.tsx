'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface OrderItem {
  product: { name: string; price: number; images?: { url: string }[] };
  quantity: number;
}

interface Order {
  id: string;
  status: string;
  total_amount: number;
  created_at: string;
  store: { name: string };
  items: OrderItem[];
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      const res = await fetch('/api/users/me/orders', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      }
    } catch (error) {
      console.error('Помилка завантаження замовлень:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
      NEW: { label: 'Нове', bg: 'bg-blue-50', text: 'text-blue-700' },
      PROCESSING: { label: 'В обробці', bg: 'bg-yellow-50', text: 'text-yellow-700' },
      SHIPPED: { label: 'Відправлено', bg: 'bg-purple-50', text: 'text-purple-700' },
      DELIVERED: { label: 'Доставлено', bg: 'bg-green-50', text: 'text-green-700' },
      CANCELED: { label: 'Скасовано', bg: 'bg-red-50', text: 'text-red-700' },
    };

    const config = statusConfig[status] || { label: status, bg: 'bg-gray-50', text: 'text-gray-700' };

    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  if (loading) return <div className="text-center py-10">Завантаження замовлень...</div>;

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Мої замовлення</h2>

      {orders.length === 0 ? (
        <div className="text-center py-12 text-gray-500 border border-dashed border-gray-300 rounded-lg">
          У вас ще немає замовлень. <br />
          <Link href="/catalog" className="text-primary font-medium hover:underline mt-2 inline-block">Перейти до каталогу</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div key={order.id} className="border border-gray-200 rounded-lg p-5 hover:border-primary transition-colors bg-white shadow-sm">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
                <div>
                  <p className="text-xs text-gray-500 mb-1">
                    Замовлення від {new Date(order.created_at).toLocaleDateString('uk-UA')}
                  </p>
                  <p className="font-medium text-gray-900">№ {order.id.slice(0, 8)}...</p>
                </div>
                <div className="flex flex-col sm:items-end gap-2">
                  {getStatusBadge(order.status)}
                  <p className="font-bold text-lg">{Number(order.total_amount)} ₴</p>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex -space-x-2 overflow-hidden">
                  {/* Показуємо аватарки перших 3-х товарів */}
                  {order.items.slice(0, 3).map((item, idx) => (
                    <div key={idx} className="inline-block h-10 w-10 rounded-full ring-2 ring-white bg-gray-100 overflow-hidden">
                      {item.product.images?.[0] ? (
                        <img src={item.product.images[0].url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gray-200" />
                      )}
                    </div>
                  ))}
                  {order.items.length > 3 && (
                    <div className="inline-flex h-10 w-10 items-center justify-center rounded-full ring-2 ring-white bg-gray-50 text-xs font-medium text-gray-500">
                      +{order.items.length - 3}
                    </div>
                  )}
                </div>

                <p className="text-sm text-gray-600">Продавець: <span className="font-medium">{order.store.name}</span></p>

                <Link
                  href={`/profile/orders/${order.id}`}
                  className="bg-secondary text-primary px-4 py-2 rounded-md font-medium text-sm hover:border-primary border border-transparent transition-colors whitespace-nowrap"
                >
                  Деталі замовлення
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}