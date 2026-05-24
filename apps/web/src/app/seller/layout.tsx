'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function SellerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Не показуємо сайдбар на сторінці реєстрації
  if (pathname === '/seller/register') {
    return <>{children}</>;
  }

  const navItems = [
    { name: 'Профіль магазину', href: '/seller/profile' },
    { name: 'Мої товари', href: '/seller/products' },
    { name: 'Замовлення', href: '/seller/orders' },
  ];

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Кабінет виробника</h1>

      <div className="flex flex-col md:flex-row gap-8">
        <aside className="w-full md:w-64 shrink-0">
          <nav className="bg-white rounded-lg shadow-sm border border-gray-100 p-2 flex flex-col gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`px-4 py-3 rounded-md transition-colors text-sm font-medium ${isActive ? 'bg-primary text-white' : 'text-gray-700 hover:bg-gray-50 hover:text-primary'}`}
                >
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="flex-1 bg-white rounded-lg shadow-sm border border-gray-100 p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}