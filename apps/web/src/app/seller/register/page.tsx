'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

export default function SellerRegistrationPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Дані форми
  const [formData, setFormData] = useState({ name: '', location: '', description: '' });
  const [document, setDocument] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!document) {
      return setError('Будь ласка, завантажте документ підтвердження');
    }

    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('accessToken');
      const submitData = new FormData();
      submitData.append('name', formData.name);
      submitData.append('location', formData.location);
      submitData.append('description', formData.description);
      submitData.append('document', document);

      // Завдяки rewrite в next.config.mjs, цей запит піде на localhost:5000
      const res = await fetch('/api/stores', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: submitData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Помилка реєстрації магазину');

      setStep(3); // Перехід до екрану успіху
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg p-8 rounded-lg shadow-sm border border-gray-200">

        {/* Прогрес-бар */}
        <div className="flex items-center justify-between mb-8 relative">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-gray-200 -z-10 rounded"></div>
          <div className={`absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-primary -z-10 rounded transition-all duration-300 ${step === 1 ? 'w-0' : step === 2 ? 'w-1/2' : 'w-full'}`}></div>

          {[1, 2, 3].map((num) => (
            <div key={num} className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 bg-white transition-colors ${step >= num ? 'border-primary text-primary' : 'border-gray-300 text-gray-400'}`}>
              {num}
            </div>
          ))}
        </div>

        {error && <div className="bg-red-50 text-danger border border-red-200 p-3 rounded-md text-sm mb-6">{error}</div>}

        {/* Крок 1: Базова інформація */}
        {step === 1 && (
          <form onSubmit={handleNextStep} className="space-y-5">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Створення магазину</h1>
              <p className="text-sm text-gray-500">Крок 1 з 2: Інформація про ваш бренд</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Назва магазину</label>
              <input
                required
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                // ДОДАНО: bg-white text-gray-900 placeholder:text-gray-400
                className="w-full bg-white text-gray-900 placeholder:text-gray-400 border border-gray-300 rounded-md p-3 text-sm focus:ring-2 focus:ring-primary outline-none"
                placeholder="Наприклад: Карпатська Пасіка"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Локація (Місто, Регіон)</label>
              <input
                required
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({...formData, location: e.target.value})}
                // ДОДАНО: bg-white text-gray-900 placeholder:text-gray-400
                className="w-full bg-white text-gray-900 placeholder:text-gray-400 border border-gray-300 rounded-md p-3 text-sm focus:ring-2 focus:ring-primary outline-none"
                placeholder="Наприклад: Яремче, Івано-Франківська обл."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Опис магазину</label>
              <textarea
                required
                rows={4}
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                // ДОДАНО: bg-white text-gray-900 placeholder:text-gray-400
                className="w-full bg-white text-gray-900 placeholder:text-gray-400 border border-gray-300 rounded-md p-3 text-sm focus:ring-2 focus:ring-primary outline-none resize-none"
                placeholder="Розкажіть про своє виробництво..."
              ></textarea>
            </div>

            <button type="submit" className="w-full bg-primary hover:bg-primary-hover text-white py-3 rounded-md font-medium transition-colors mt-4">
              Продовжити
            </button>
          </form>
        )}

        {/* Крок 2: Документи */}
        {step === 2 && (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Підтвердження особи</h1>
              <p className="text-sm text-gray-500">Крок 2 з 2: Завантаження документів</p>
            </div>

            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${document ? 'border-primary bg-secondary' : 'border-gray-300 hover:border-primary hover:bg-gray-50 bg-white'}`}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".pdf,image/jpeg,image/png"
                onChange={(e) => setDocument(e.target.files?.[0] || null)}
              />
              {document ? (
                <div>
                  <svg className="w-8 h-8 text-primary mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <p className="text-sm font-medium text-gray-900">{document.name}</p>
                  <p className="text-xs text-gray-500 mt-1">{(document.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              ) : (
                <div>
                  <svg className="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                  <p className="text-sm font-medium text-gray-700">Натисніть для завантаження файлу</p>
                  <p className="text-xs text-gray-500 mt-1">PDF, JPG або PNG (до 5 МБ)</p>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={() => setStep(1)} className="w-1/3 bg-gray-100 text-gray-700 py-3 rounded-md font-medium hover:bg-gray-200 transition-colors">
                Назад
              </button>
              <button type="submit" disabled={loading || !document} className="w-2/3 bg-primary text-white py-3 rounded-md font-medium hover:bg-primary-hover transition-colors disabled:opacity-50">
                {loading ? 'Надсилання...' : 'Надіслати заявку'}
              </button>
            </div>
          </form>
        )}

        {/* Крок 3: Успіх */}
        {step === 3 && (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-100 text-success rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Заявку надіслано!</h1>
            <p className="text-gray-600 mb-8">Ми перевіримо ваші документи протягом 24 годин. Ви отримаєте сповіщення на email після модерації.</p>
            <button onClick={() => router.push('/seller/profile')} className="bg-primary hover:bg-primary-hover text-white px-8 py-3 rounded-md font-medium transition-colors">
              Перейти в кабінет виробника
            </button>
          </div>
        )}
      </div>
    </main>
  );
}