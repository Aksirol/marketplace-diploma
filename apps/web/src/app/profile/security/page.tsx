'use client';

import { useState } from 'react';

export default function SecurityPage() {
  const [formData, setFormData] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);

    if (formData.newPassword !== formData.confirmPassword) {
      return setStatus({ type: 'error', msg: 'Нові паролі не збігаються' });
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('/api/users/me/password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          oldPassword: formData.oldPassword,
          newPassword: formData.newPassword
        })
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Помилка зміни пароля');

      setStatus({ type: 'success', msg: 'Пароль успішно змінено!' });
      setFormData({ oldPassword: '', newPassword: '', confirmPassword: '' }); // Очищення форми
    } catch (err: any) {
      setStatus({ type: 'error', msg: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Безпека</h2>
      <p className="text-gray-500 text-sm mb-6">Оновіть свій пароль, щоб зберегти акаунт у безпеці.</p>

      {status && (
        <div className={`p-4 rounded-md mb-6 max-w-md ${status.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
          {status.msg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Поточний пароль</label>
          <input
            type="password"
            required
            value={formData.oldPassword}
            onChange={(e) => setFormData({...formData, oldPassword: e.target.value})}
            className="w-full border border-gray-300 rounded-md p-3 text-sm focus:ring-2 focus:ring-primary outline-none transition-shadow"
          />
        </div>

        <div className="pt-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Новий пароль</label>
          <input
            type="password"
            required
            minLength={6}
            value={formData.newPassword}
            onChange={(e) => setFormData({...formData, newPassword: e.target.value})}
            className="w-full border border-gray-300 rounded-md p-3 text-sm focus:ring-2 focus:ring-primary outline-none transition-shadow"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Підтвердіть новий пароль</label>
          <input
            type="password"
            required
            minLength={6}
            value={formData.confirmPassword}
            onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
            className="w-full border border-gray-300 rounded-md p-3 text-sm focus:ring-2 focus:ring-primary outline-none transition-shadow"
          />
        </div>

        <div className="pt-4 border-t mt-6">
          <button
            type="submit"
            disabled={saving}
            className="bg-primary text-white px-6 py-3 rounded-md font-medium hover:bg-opacity-90 transition-colors disabled:bg-gray-400"
          >
            {saving ? 'Оновлення...' : 'Оновити пароль'}
          </button>
        </div>
      </form>
    </div>
  );
}