import Link from 'next/link';
import AddToCartButton from '@/components/AddToCartButton';

async function getProduct(id: string) {
  const baseUrl = process.env.API_INTERNAL_URL || 'http://localhost:4000';
  const res = await fetch(`${baseUrl}/api/products/${id}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return res.json();
}

export default async function ProductPage({ params }: { params: { id: string } }) {
  const product = await getProduct(params.id);

  if (!product) {
    return <div className="p-8 text-center text-2xl font-bold">Товар не знайдено</div>;
  }

  return (
    <main className="max-w-7xl mx-auto p-4 md:p-8">
      {/* Хлібні крихти */}
      <nav className="text-sm text-gray-500 mb-8 flex gap-2">
        <Link href="/catalog" className="hover:text-primary transition">Каталог</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        {/* Галерея зображень */}
        <div className="bg-gray-100 rounded-2xl aspect-square overflow-hidden flex items-center justify-center">
          {product.images?.[0] ? (
            <img src={product.images[0].url} alt={product.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-gray-400">Зображення відсутнє</span>
          )}
        </div>

        {/* Інформація про товар */}
        <div className="flex flex-col">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{product.name}</h1>

          <div className="flex items-center gap-2 mb-6">
            <span className="text-sm text-gray-500">Виробник:</span>
            <Link href={`/store/${product.store.id}`} className="text-sm font-medium text-primary hover:underline">
              {product.store.name}
            </Link>
            <span className="text-sm text-gray-400 ml-2">📍 {product.store.location || 'Не вказано'}</span>
          </div>

          <div className="text-4xl font-bold text-gray-900 mb-4">{Number(product.price)} ₴</div>

          <div className={`text-sm font-medium mb-8 ${product.stock_qty > 0 ? 'text-success' : 'text-danger'}`}>
            {product.stock_qty > 0 ? `В наявності: ${product.stock_qty} шт.` : 'Немає в наявності'}
          </div>

          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-2">Опис</h3>
            <p className="text-gray-600 leading-relaxed whitespace-pre-line">
              {product.description || 'Опис відсутній.'}
            </p>
          </div>

          {/* Клієнтська кнопка додавання в кошик */}
          <div className="mt-auto">
            <AddToCartButton productId={product.id} stockQty={product.stock_qty} />
          </div>
        </div>
      </div>
    </main>
  );
}