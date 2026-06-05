'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NewProductForm() {
  const router = useRouter();
  const [categories, setCategories] = useState<any[]>([]);
  const [formData, setFormData] = useState({ name: '', description: '', price: '', stock_qty: '', category_id: '' });
  const [images, setImages] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/categories').then(res => res.json()).then(data => {
      const flatCats: any[] = [];
      const flatten = (cats: any[], prefix = '') => {
        cats.forEach(c => {
          flatCats.push({ id: c.id, name: prefix + c.name });
          if (c.children) flatten(c.children, prefix + '— ');
        });
      };
      flatten(data);
      setCategories(flatCats);
      if (flatCats.length > 0) setFormData(prev => ({ ...prev, category_id: flatCats[0].id }));
    });
  }, []);

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
  };
  const handleFiles = (filesList: FileList) => {
    const newFiles = Array.from(filesList).filter(f => f.type.startsWith('image/'));
    if (images.length + newFiles.length > 5) {
      alert('Можна завантажити максимум 5 фотографій');
      return;
    }
    setImages(prev => [...prev, ...newFiles]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');

    try {
      const token = localStorage.getItem('accessToken');

      const prodRes = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          ...formData,
          price: Number(formData.price),
          stock_qty: Number(formData.stock_qty)
        })
      });
      const prodData = await prodRes.json();
      if (!prodRes.ok) throw new Error(prodData.message || 'Помилка створення товару');

      if (images.length > 0) {
        const imgData = new FormData();
        images.forEach(img => imgData.append('images', img));

        await fetch(`/api/products/${prodData.product.id}/images`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: imgData
        });
      }

      router.push('/seller/products');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto pb-10">
      <Link href="/seller/products" className="text-sm font-medium text-primary hover:underline mb-4 inline-flex items-center gap-1">
        <span>&larr;</span> Назад до товарів
      </Link>

      <h2 className="text-2xl font-bold text-gray-900 mb-6">Додавання нового товару</h2>

      {error && (
        <div className="bg-red-50 border border-danger text-danger px-4 py-3 rounded-lg mb-6 text-sm font-medium">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Основна інформація */}
        <div className="bg-white p-6 border border-gray-200 rounded-xl shadow-sm">
          <h3 className="font-bold text-lg text-gray-900 mb-5">Основна інформація</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Назва товару</label>
              <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all" placeholder="Наприклад: Липовий мед 1л"/>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Категорія</label>
              <select required value={formData.category_id} onChange={e => setFormData({...formData, category_id: e.target.value})} className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all bg-white">
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Ціна (₴)</label>
              <input required type="number" min="1" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all" placeholder="0"/>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Залишок на складі (шт)</label>
              <input required type="number" min="0" value={formData.stock_qty} onChange={e => setFormData({...formData, stock_qty: e.target.value})} className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all" placeholder="0"/>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Опис товару</label>
            <textarea rows={4} required value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none resize-none transition-all" placeholder="Опишіть властивості, склад, походження..."></textarea>
          </div>
        </div>

        {/* Галерея */}
        <div className="bg-white p-6 border border-gray-200 rounded-xl shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg text-gray-900">Галерея фотографій</h3>
            <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">{images.length} / 5</span>
          </div>

          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 bg-gray-50 rounded-xl p-10 text-center cursor-pointer hover:border-primary hover:bg-secondary transition-colors"
          >
            <input type="file" multiple accept="image/*" className="hidden" ref={fileInputRef} onChange={e => e.target.files && handleFiles(e.target.files)} />
            <div className="w-12 h-12 bg-white shadow-sm rounded-full flex items-center justify-center mx-auto mb-3 text-primary">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </div>
            <p className="text-sm font-semibold text-gray-700">Натисніть або перетягніть файли</p>
            <p className="text-xs text-gray-500 mt-1">PNG, JPG до 5МБ</p>
          </div>

          {images.length > 0 && (
            <div className="flex gap-4 mt-5 overflow-x-auto pb-2">
              {images.map((img, i) => (
                <div key={i} className="relative w-28 h-28 shrink-0 rounded-lg border border-gray-200 overflow-hidden shadow-sm group">
                  <img src={URL.createObjectURL(img)} alt="" className="w-full h-full object-cover"/>

                  {/* Кнопка видалення (Custom Danger Color) */}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setImages(images.filter((_, idx) => idx !== i)); }}
                    className="absolute top-1.5 right-1.5 bg-white text-danger hover:bg-danger hover:text-white rounded-md w-6 h-6 flex items-center justify-center text-sm font-bold shadow transition-colors opacity-0 group-hover:opacity-100"
                  >
                    ×
                  </button>

                  {/* Бейдж Primary (Custom Primary Color) */}
                  {i === 0 && (
                    <div className="absolute bottom-0 left-0 right-0 bg-primary text-secondary text-[10px] text-center font-bold py-1 tracking-wider uppercase">
                      Головне
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary hover:bg-primary-hover text-white py-4 rounded-xl font-bold text-lg transition-colors shadow-md disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading && <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
          {loading ? 'Публікація...' : 'Опублікувати товар'}
        </button>
      </form>
    </div>
  );
}