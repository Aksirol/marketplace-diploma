'use client';

import { useState, useEffect } from 'react';

interface Address {
  id: string;
  title: string;
  city: string;
  street: string;
  zip_code: string;
}

export default function AddressesPage() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);

  // Стейт для нової адреси
  const [isAdding, setIsAdding] = useState(false);
  const [newAddress, setNewAddress] = useState({ title: '', city: '', street: '', zip_code: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAddresses();
  }, []);

  const fetchAddresses = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      const res = await fetch('/api/users/me/addresses', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        setAddresses(data);
      }
    } catch (error) {
      console.error('Помилка завантаження адрес:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('/api/users/me/addresses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newAddress)
      });

      if (res.ok) {
        const createdAddress = await res.json();
        setAddresses([...addresses, createdAddress]);
        setIsAdding(false);
        setNewAddress({ title: '', city: '', street: '', zip_code: '' }); // Очищення форми
      } else {
        const data = await res.json();
        alert(data.message || 'Помилка при створенні адреси');
      }
    } catch (error) {
      console.error('Помилка:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Ви впевнені, що хочете видалити цю адресу?')) return;

    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`/api/users/me/addresses/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        setAddresses(addresses.filter(a => a.id !== id));
      }
    } catch (error) {
      console.error('Помилка видалення:', error);
    }
  };

  if (loading) return <div className="text-center py-10">Завантаження...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Мої адреси</h2>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="bg-primary text-white px-4 py-2 rounded-md font-medium hover:bg-opacity-90 transition-colors text-sm"
          >
            + Додати адресу
          </button>
        )}
      </div>

      {/* Форма додавання нової адреси */}
      {isAdding && (
        <form onSubmit={handleAddAddress} className="bg-gray-50 p-6 rounded-lg border border-gray-200 mb-8 space-y-4">
          <h3 className="font-semibold text-gray-800 mb-2">Нова адреса</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Назва (напр. Дім)</label>
              <input required type="text" value={newAddress.title} onChange={e => setNewAddress({...newAddress, title: e.target.value})} className="w-full border border-gray-300 rounded p-2 text-sm outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Місто</label>
              <input required type="text" value={newAddress.city} onChange={e => setNewAddress({...newAddress, city: e.target.value})} className="w-full border border-gray-300 rounded p-2 text-sm outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Вулиця та будинок (або відділення НП)</label>
              <input required type="text" value={newAddress.street} onChange={e => setNewAddress({...newAddress, street: e.target.value})} className="w-full border border-gray-300 rounded p-2 text-sm outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Поштовий індекс</label>
              <input required type="text" value={newAddress.zip_code} onChange={e => setNewAddress({...newAddress, zip_code: e.target.value})} className="w-full border border-gray-300 rounded p-2 text-sm outline-none focus:ring-1 focus:ring-primary" />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={saving} className="bg-primary text-white px-4 py-2 rounded text-sm font-medium hover:bg-opacity-90">{saving ? 'Збереження...' : 'Зберегти'}</button>
            <button type="button" onClick={() => setIsAdding(false)} className="bg-gray-200 text-gray-700 px-4 py-2 rounded text-sm font-medium hover:bg-gray-300">Скасувати</button>
          </div>
        </form>
      )}

      {/* Список збережених адрес */}
      {addresses.length === 0 && !isAdding ? (
        <div className="text-center py-12 text-gray-500 border border-dashed border-gray-300 rounded-lg">
          У вас ще немає збережених адрес
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {addresses.map((address) => (
            <div key={address.id} className="border border-gray-200 rounded-lg p-5 hover:border-primary transition-colors relative group">
              <button
                onClick={() => handleDelete(address.id)}
                className="absolute top-4 right-4 text-gray-400 hover:text-red-500 hidden group-hover:block"
                title="Видалити"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
              </button>

              <div className="flex items-center gap-2 mb-3">
                <span className="bg-secondary text-primary text-xs font-bold px-2 py-1 rounded uppercase tracking-wider">
                  {address.title}
                </span>
              </div>
              <p className="text-gray-900 font-medium">{address.street}</p>
              <p className="text-gray-600 text-sm">{address.city}</p>
              <p className="text-gray-500 text-sm mt-1">{address.zip_code}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}