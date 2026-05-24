import Link from 'next/link';

async function getStore(id: string) {
  const res = await fetch(`http://api:4000/api/stores/${id}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return res.json();
}

export default async function StorePage({ params }: { params: { id: string } }) {
  const store = await getStore(params.id);

  if (!store) {
    return <div className="p-8 text-center text-2xl font-bold">Магазин не знайдено</div>;
  }

  return (
    <main className="max-w-7xl mx-auto p-4 md:p-8">
      {/* Шапка магазину */}
      <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm mb-10 flex flex-col md:flex-row items-center gap-8">
        <div className="w-32 h-32 bg-secondary rounded-full flex items-center justify-center text-primary font-bold text-4xl shrink-0 overflow-hidden">
          {store.logo_url ? (
            <img src={store.logo_url} alt={store.name} className="w-full h-full object-cover" />
          ) : (
            store.name.charAt(0).toUpperCase()
          )}
        </div>

        <div className="text-center md:text-left">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{store.name}</h1>
          <p className="text-gray-600 mb-4 max-w-2xl">{store.description || 'Виробник локальної крафтової продукції.'}</p>
          <div className="inline-flex items-center gap-2 bg-gray-50 px-3 py-1 rounded-full text-sm font-medium text-gray-700">
            📍 {store.location || 'Локація не вказана'}
          </div>
        </div>
      </div>

      <h2 className="text-2xl font-bold mb-6 border-b pb-4">Товари цього виробника</h2>

      {/* Сітка товарів магазину */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {store.products.length > 0 ? (
          store.products.map((product: any) => (
            <Link key={product.id} href={`/product/${product.id}`} className="group block">
              <div className="bg-white border border-gray-100 rounded-lg p-4 shadow-sm hover:border-primary transition-colors flex flex-col h-full">
                <div className="h-48 bg-gray-100 rounded-md mb-4 overflow-hidden">
                  {product.images?.[0] && (
                    <img src={product.images[0].url} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  )}
                </div>
                <h3 className="font-medium text-gray-900 mb-2">{product.name}</h3>
                <div className="mt-auto text-lg font-bold text-primary">{Number(product.price)} ₴</div>
              </div>
            </Link>
          ))
        ) : (
          <div className="col-span-full py-8 text-center text-gray-500">
            У цього магазину поки немає активних товарів.
          </div>
        )}
      </div>
    </main>
  );
}