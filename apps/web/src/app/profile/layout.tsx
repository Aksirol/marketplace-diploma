'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function ProfileLayout({
                                        children,
                                      }: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const navItems = [
    { name: 'Особисті дані', href: '/profile' },
    { name: 'Мої замовлення', href: '/profile/orders' },  // <--- Додано
    { name: 'Список бажань', href: '/profile/wishlist' }, // <--- Додано
    { name: 'Мої адреси', href: '/profile/addresses' },
    { name: 'Безпека', href: '/profile/security' },
  ];

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Особистий кабінет</h1>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Бічне меню навігації */}
        <aside className="w-full md:w-64 shrink-0">
          <nav className="bg-white rounded-lg shadow-sm border border-gray-100 p-2 flex flex-col gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`px-4 py-3 rounded-md transition-colors text-sm font-medium ${
                    isActive
                      ? 'bg-primary text-white'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-primary'
                  }`}
                >
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Контент вибраної сторінки */}
        <main className="flex-1 bg-white rounded-lg shadow-sm border border-gray-100 p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}