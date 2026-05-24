'use client';

import { useState, useEffect, useRef } from 'react';

interface UserProfile {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  avatar_url: string | null;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile>({
    first_name: '', last_name: '', email: '', phone: '', avatar_url: null
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return; // Тут в реальності треба редірект на логін

      const res = await fetch('/api/users/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        setProfile({
          first_name: data.first_name || '',
          last_name: data.last_name || '',
          email: data.email || '',
          phone: data.phone || '',
          avatar_url: data.avatar_url
        });
      }
    } catch (error) {
      console.error('Помилка завантаження профілю:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAvatarFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatus(null);

    const token = localStorage.getItem('accessToken');

    // Використовуємо FormData, бо ми можемо відправляти файл
    const formData = new FormData();
    formData.append('first_name', profile.first_name);
    formData.append('last_name', profile.last_name);
    formData.append('phone', profile.phone);

    if (avatarFile) {
      formData.append('avatar', avatarFile);
    }

    try {
      const res = await fetch('/api/users/me', {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData, // Браузер сам встановить Content-Type: multipart/form-data
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Помилка оновлення профілю');

      setStatus({ type: 'success', msg: 'Профіль успішно оновлено!' });

      // Оновлюємо локальний стейт новою URL аватарки, якщо вона повернулась
      if (data.user?.avatar_url) {
        setProfile(prev => ({ ...prev, avatar_url: data.user.avatar_url }));
        setAvatarFile(null); // Очищаємо обраний файл після успішного завантаження
      }
    } catch (err: any) {
      setStatus({ type: 'error', msg: err.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-center py-10">Завантаження...</div>;

  // Створюємо URL для прев'ю обраного файлу
  const avatarPreview = avatarFile ? URL.createObjectURL(avatarFile) : profile.avatar_url;

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Особисті дані</h2>

      {status && (
        <div className={`p-4 rounded-md mb-6 ${status.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
          {status.msg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">

        {/* Аватар */}
        <div className="flex items-center gap-6">
          <div className="w-24 h-24 rounded-full bg-gray-200 overflow-hidden shrink-0 flex items-center justify-center border-2 border-gray-100">
            {avatarPreview ? (
              <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-gray-400 text-3xl font-bold">
                {profile.first_name ? profile.first_name.charAt(0) : '?'}
              </span>
            )}
          </div>
          <div>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              ref={fileInputRef}
              onChange={handleAvatarChange}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Змінити фото
            </button>
            <p className="text-xs text-gray-500 mt-2">Рекомендований розмір: 200x200px (до 2MB)</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ім'я</label>
            <input
              type="text"
              value={profile.first_name}
              onChange={(e) => setProfile({...profile, first_name: e.target.value})}
              className="w-full border border-gray-300 rounded-md p-3 text-sm focus:ring-2 focus:ring-primary outline-none transition-shadow"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Прізвище</label>
            <input
              type="text"
              value={profile.last_name}
              onChange={(e) => setProfile({...profile, last_name: e.target.value})}
              className="w-full border border-gray-300 rounded-md p-3 text-sm focus:ring-2 focus:ring-primary outline-none transition-shadow"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Електронна пошта</label>
          <input
            type="email"
            value={profile.email}
            disabled
            className="w-full border border-gray-300 rounded-md p-3 text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
          />
          <p className="text-xs text-gray-500 mt-1">Email не можна змінити, оскільки він використовується для входу.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Номер телефону</label>
          <input
            type="text"
            placeholder="+380..."
            value={profile.phone}
            onChange={(e) => setProfile({...profile, phone: e.target.value})}
            className="w-full border border-gray-300 rounded-md p-3 text-sm focus:ring-2 focus:ring-primary outline-none transition-shadow"
          />
        </div>

        <div className="pt-4 border-t">
          <button
            type="submit"
            disabled={saving}
            className="bg-primary text-white px-6 py-3 rounded-md font-medium hover:bg-opacity-90 transition-colors disabled:bg-gray-400"
          >
            {saving ? 'Збереження...' : 'Зберегти зміни'}
          </button>
        </div>
      </form>
    </div>
  );
}