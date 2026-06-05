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
      <div className="bg-white w-full max-w-md p-8 rounded-xl shadow-sm border border-gray-200">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Створити акаунт</h1>
          <p className="text-sm text-gray-500">Долучайтесь до нашої спільноти</p>
        </div>

        {status && (
          <div className={`p-4 rounded-lg text-sm mb-6 font-medium border ${status.type === 'success' ? 'bg-green-50 text-success border-green-200' : 'bg-red-50 text-danger border-red-200'}`}>
            {status.msg}
          </div>
        )}

        {status?.type !== 'success' && (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Ім'я</label>
              <input
                type="text"
                required
                value={formData.first_name}
                onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                // ДОДАНО: bg-white text-gray-900 placeholder:text-gray-400
                className="w-full bg-white text-gray-900 placeholder:text-gray-400 border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-primary outline-none transition-all"
                placeholder="Іван"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Електронна пошта</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                // ДОДАНО: bg-white text-gray-900 placeholder:text-gray-400
                className="w-full bg-white text-gray-900 placeholder:text-gray-400 border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-primary outline-none transition-all"
                placeholder="email@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Пароль</label>
              <input
                type="password"
                required
                minLength={8} // Змінено на 8, щоб відповідати бекенду
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                // ДОДАНО: bg-white text-gray-900 placeholder:text-gray-400
                className="w-full bg-white text-gray-900 placeholder:text-gray-400 border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-primary outline-none transition-all"
                placeholder="Мінімум 8 символів"
              />
            </div>

            <button type="submit" disabled={loading} className="w-full bg-primary hover:bg-primary-hover text-white py-3.5 rounded-lg font-medium transition-colors disabled:opacity-70 mt-6 shadow-sm">
              {loading ? 'Створення...' : 'Зареєструватися'}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-gray-600 mt-8">
          Вже маєте акаунт? <Link href="/login" className="text-primary font-bold hover:underline">Увійти</Link>
        </p>
      </div>
    </main>
  );
}