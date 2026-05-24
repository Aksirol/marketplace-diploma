'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    first_name: '', email: '', password: '', role: 'USER'
  });
  const [status, setStatus] = useState<{ type: 'error' | 'success', msg: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Помилка реєстрації');

      setStatus({ type: 'success', msg: data.message });
    } catch (err: any) {
      setStatus({ type: 'error', msg: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md p-8 rounded-lg shadow-sm border border-gray-100">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Створити акаунт</h1>
          <p className="text-sm text-gray-500">Долучайтесь до нашої спільноти</p>
        </div>

        {status && (
          <div className={`p-3 rounded-md text-sm mb-4 ${status.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
            {status.msg}
          </div>
        )}

        {status?.type !== 'success' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ім'я</label>
              <input type="text" required value={formData.first_name} onChange={(e) => setFormData({...formData, first_name: e.target.value})} className="w-full border border-gray-300 rounded-md p-3 text-sm focus:ring-2 focus:ring-primary outline-none" placeholder="Іван" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Електронна пошта</label>
              <input type="email" required value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="w-full border border-gray-300 rounded-md p-3 text-sm focus:ring-2 focus:ring-primary outline-none" placeholder="email@example.com" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Пароль</label>
              <input type="password" required minLength={6} value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} className="w-full border border-gray-300 rounded-md p-3 text-sm focus:ring-2 focus:ring-primary outline-none" placeholder="Мінімум 6 символів" />
            </div>

            <button type="submit" disabled={loading} className="w-full bg-primary text-white py-3 rounded-md font-medium hover:bg-opacity-90 transition-colors disabled:bg-gray-400 mt-4">
              {loading ? 'Створення...' : 'Зареєструватися'}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-gray-600 mt-6">
          Вже маєте акаунт? <Link href="/login" className="text-primary font-medium hover:underline">Увійти</Link>
        </p>
      </div>
    </main>
  );
}