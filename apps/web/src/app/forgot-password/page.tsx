'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<{ type: 'error' | 'success', msg: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setStatus({ type: 'success', msg: data.message });
    } catch (err: any) {
      setStatus({ type: 'error', msg: err.message });
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md p-8 rounded-lg shadow-sm border border-gray-100">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Відновлення пароля</h1>
        <p className="text-sm text-gray-500 mb-6">Введіть email, і ми надішлемо посилання для відновлення.</p>

        {status && <div className={`p-3 rounded-md text-sm mb-4 ${status.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>{status.msg}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border border-gray-300 rounded-md p-3 text-sm focus:ring-2 focus:ring-primary outline-none" placeholder="Введіть ваш email" />
          <button type="submit" className="w-full bg-primary text-white py-3 rounded-md font-medium hover:bg-opacity-90">Надіслати інструкції</button>
        </form>

        <div className="mt-6 text-center">
          <Link href="/login" className="text-sm text-primary font-medium hover:underline">← Повернутися до входу</Link>
        </div>
      </div>
    </main>
  );
}