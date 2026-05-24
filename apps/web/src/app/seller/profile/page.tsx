'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

export default function SellerProfilePage() {
  const router = useRouter();
  const [store, setStore] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Файли
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchStore();
  }, []);

  const fetchStore = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return router.push('/login');

      const res = await fetch('/api/stores/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.status === 404) {
        return router.push('/seller/register'); // Якщо немає магазину - на реєстрацію
      }

      if (res.ok) {
        setStore(await res.json());
      }
    } catch (error) {
      console.error('Помилка завантаження профілю магазину:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatusMsg(null);

    try {
      const token = localStorage.getItem('accessToken');
      const formData = new FormData();
      formData.append('name', store.name);
      formData.append('description', store.description);
      formData.append('location', store.location);

      if (logoFile) formData.append('logo', logoFile);
      if (bannerFile) formData.append('banner', bannerFile);

      const res = await fetch('/api/stores/me', {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      setStatusMsg({ type: 'success', text: 'Профіль магазину успішно оновлено!' });
      setStore(data.store);
      setLogoFile(null);
      setBannerFile(null);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Помилка збереження' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-center py-10">Завантаження...</div>;
  if (!store) return null;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Профіль магазину</h2>
        {store.status === 'PENDING' && (
          <span className="bg-yellow-100 text-yellow-800 text-xs font-bold px-3 py-1 rounded-full uppercase">
            Очікує модерації
          </span>
        )}
      </div>

      {statusMsg && (
        <div className={`p-4 rounded-md mb-6 ${statusMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
          {statusMsg.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">

        {/* Банер */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Банер магазину</label>
          <div
            className="w-full h-48 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer overflow-hidden relative hover:bg-gray-50 transition"
            onClick={() => bannerInputRef.current?.click()}
          >
            {bannerFile || store.banner_url ? (
              <img src={bannerFile ? URL.createObjectURL(bannerFile) : store.banner_url} alt="Banner" className="w-full h-full object-cover" />
            ) : (
              <span className="text-sm text-gray-500">Натисніть для завантаження банера (реком. 1200x400)</span>
            )}
            <input type="file" ref={bannerInputRef} className="hidden" accept="image/*" onChange={(e) => setBannerFile(e.target.files?.[0] || null)} />
          </div>
        </div>

        {/* Логотип та Основні дані */}
        <div className="flex flex-col md:flex-row gap-6">
          <div className="shrink-0">
            <label className="block text-sm font-medium text-gray-700 mb-2">Логотип</label>
            <div
              className="w-32 h-32 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer overflow-hidden hover:bg-gray-50 transition"
              onClick={() => logoInputRef.current?.click()}
            >
              {logoFile || store.logo_url ? (
                <img src={logoFile ? URL.createObjectURL(logoFile) : store.logo_url} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs text-gray-500 text-center px-2">Завантажити лого</span>
              )}
              <input type="file" ref={logoInputRef} className="hidden" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} />
            </div>
          </div>

          <div className="flex-1 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Назва магазину</label>
              <input type="text" required value={store.name} onChange={(e) => setStore({...store, name: e.target.value})} className="w-full border border-gray-300 rounded-md p-3 text-sm focus:ring-2 focus:ring-primary outline-none" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Локація</label>
              <input type="text" required value={store.location} onChange={(e) => setStore({...store, location: e.target.value})} className="w-full border border-gray-300 rounded-md p-3 text-sm focus:ring-2 focus:ring-primary outline-none" />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Опис магазину</label>
          <textarea required rows={5} value={store.description} onChange={(e) => setStore({...store, description: e.target.value})} className="w-full border border-gray-300 rounded-md p-3 text-sm focus:ring-2 focus:ring-primary outline-none resize-none"></textarea>
        </div>

        <div className="pt-4 border-t">
          <button type="submit" disabled={saving} className="bg-primary text-white px-6 py-3 rounded-md font-medium hover:bg-opacity-90 transition-colors disabled:opacity-50">
            {saving ? 'Збереження...' : 'Зберегти зміни'}
          </button>
        </div>
      </form>
    </div>
  );
}