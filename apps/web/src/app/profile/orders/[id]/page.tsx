'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function OrderDetailsPage({ params }: { params: { id: string } }) {
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [canceling, setCanceling] = useState(false);

  // Стейт для відгуку
  const [reviewingProductId, setReviewingProductId] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [reviewStatus, setReviewStatus] = useState<{ type: 'error' | 'success', msg: string } | null>(null);
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    fetchOrder();
  }, [params.id]);

  const fetchOrder = async () => {
    try {
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
        fetchOrder(); // Оновлюємо дані, щоб приховати кнопку скасування
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

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingProductId) return;

    setSubmittingReview(true);
    setReviewStatus(null);

    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          order_id: order.id,
          product_id: reviewingProductId,
          rating,
          comment
        })
      });

      const data = await res.json();

      if (res.ok) {
        setReviewStatus({ type: 'success', msg: 'Дякуємо за ваш відгук!' });
        setTimeout(() => {
          setReviewingProductId(null);
          setReviewStatus(null);
          setComment('');
          setRating(5);
        }, 2000); // Закриваємо форму через 2 секунди
      } else {
        setReviewStatus({ type: 'error', msg: data.message });
      }
    } catch (error) {
      setReviewStatus({ type: 'error', msg: 'Помилка відправки відгуку' });
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) return <div className="text-center py-10">Завантаження...</div>;
  if (!order) return <div className="text-center py-10">Замовлення не знайдено</div>;

  const canCancel = order.status === 'NEW' || order.status === 'PROCESSING';
  const canReview = order.status === 'DELIVERED'; // Відгук тільки після доставки

  return (
    <div>
      <div className="mb-6">
        <Link href="/profile/orders" className="text-sm text-primary hover:underline mb-4 inline-block">
          ← Назад до замовлень
        </Link>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
          <h2 className="text-2xl font-bold text-gray-900">Замовлення № {order.id.slice(0, 8)}...</h2>
          <span className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-xs font-medium uppercase tracking-wider self-start sm:self-auto">
            {order.status}
          </span>
        </div>
      </div>

      {/* Інформація про замовлення */}
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
        <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 uppercase text-xs text-gray-500 flex justify-between">
          <span>Товар</span>
          <span>Деталі</span>
        </div>

        <div className="divide-y divide-gray-100">
          {order.items.map((item: any) => (
            <div key={item.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4 flex-1">
                <div className="w-16 h-16 bg-gray-100 rounded flex-shrink-0 overflow-hidden">
                  {item.product.images?.[0] && <img src={item.product.images[0].url} alt="" className="w-full h-full object-cover" />}
                </div>
                <div>
                  <Link href={`/product/${item.product.id}`} className="font-medium text-gray-900 hover:text-primary transition-colors">
                    {item.product.name}
                  </Link>
                  <p className="text-sm text-gray-500 mt-1">
                    {Number(item.unit_price)} ₴ × {item.quantity} шт = <span className="font-semibold text-gray-800">{Number(item.unit_price) * item.quantity} ₴</span>
                  </p>
                </div>
              </div>

              {/* Кнопка "Залишити відгук" */}
              {canReview && reviewingProductId !== item.product.id && (
                <button
                  onClick={() => {
                    setReviewingProductId(item.product.id);
                    setReviewStatus(null); // Очищаємо статус при відкритті іншої форми
                  }}
                  className="text-sm bg-white border border-primary text-primary px-4 py-2 rounded-md font-medium hover:bg-secondary transition-colors"
                >
                  Залишити відгук
                </button>
              )}

              {/* Форма відгуку */}
              {reviewingProductId === item.product.id && (
                <form onSubmit={submitReview} className="bg-gray-50 p-4 rounded-lg border border-gray-200 w-full md:w-[400px]">
                  <h4 className="font-semibold mb-3 text-sm">Оцініть {item.product.name}</h4>

                  {reviewStatus && (
                    <div className={`p-2 mb-3 rounded text-xs ${reviewStatus.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {reviewStatus.msg}
                    </div>
                  )}

                  <div className="flex gap-1 mb-3">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-lg focus:outline-none ${rating >= star ? 'bg-yellow-100 text-yellow-500' : 'bg-gray-200 text-gray-400'}`}
                      >
                        ★
                      </button>
                    ))}
                  </div>

                  <textarea
                    placeholder="Напишіть ваші враження..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="w-full border border-gray-300 rounded p-2 text-sm outline-none focus:ring-1 focus:ring-primary mb-3 h-20 resize-none"
                  />

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setReviewingProductId(null)}
                      className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200 rounded"
                    >
                      Скасувати
                    </button>
                    <button
                      type="submit"
                      disabled={submittingReview}
                      className="px-3 py-1.5 text-xs font-medium bg-primary text-white hover:bg-opacity-90 rounded disabled:opacity-50"
                    >
                      {submittingReview ? 'Відправка...' : 'Відправити'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          ))}
        </div>

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