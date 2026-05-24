import Link from 'next/link';
import FilterBar from '@/components/FilterBar';

async function getProducts(searchParams: Record<string, string>) {
  const params = new URLSearchParams(searchParams);

  // Якщо ми в Docker, використається API_INTERNAL_URL (http://api:4000)
  // Якщо запускаємо npm run dev на комп'ютері, спрацює фолбек (http://localhost:4000)
  const baseUrl = process.env.API_INTERNAL_URL || 'http://localhost:4000';

  try {
    const res = await fetch(`${baseUrl}/api/products?${params.toString()}`, {
      cache: 'no-store'
    });

    if (!res.ok) {
      console.error('Помилка API:', res.status);
      return { products: [] };
    }

    return res.json();
  } catch (error) {
    console.error('Помилка з\'єднання з бекендом:', error);
    return { products: [] };
  }
}

export default async function CatalogPage({ searchParams }: { searchParams: Record<string, string> }) {
  const data = await getProducts(searchParams);

  return (
    <main className="max-w-7xl mx-auto p-4 md:p-8 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Каталог товарів</h1>

      {/* Підключаємо створений раніше FilterBar */}
      <FilterBar />

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {data.products.length > 0 ? (
          data.products.map((product: any) => (
            <div key={product.id} className="bg-white border border-gray-100 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow group flex flex-col">
              <div className="h-48 bg-gray-100 rounded-md mb-4 overflow-hidden relative">
                {product.images?.[0] ? (
                  <img src={product.images[0].url} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">Немає фото</div>
                )}
              </div>

              <Link href={`/store/${product.store_id}`} className="text-xs text-primary font-medium hover:underline mb-1">
                {product.store?.name}
              </Link>

              <h2 className="font-medium text-gray-800 text-lg mb-2 flex-1 line-clamp-2">{product.name}</h2>

              <div className="flex items-center justify-between mt-auto">
                <span className="text-xl font-bold text-gray-900">{Number(product.price)} ₴</span>
              </div>

              <Link
                href={`/product/${product.id}`}
                className="block text-center w-full bg-secondary text-primary border border-transparent mt-4 py-2 rounded-md font-medium hover:border-primary transition-colors"
              >
                Детальніше
              </Link>
            </div>
          ))
        ) : (
          <div className="col-span-full py-12 text-center text-gray-500">
            За вашим запитом нічого не знайдено. Спробуйте змінити фільтри.
          </div>
        )}
      </div>
    </main>
  );
}