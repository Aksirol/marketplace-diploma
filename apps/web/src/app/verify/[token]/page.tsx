import Link from 'next/link';

async function verifyToken(token: string) {
  const baseUrl = process.env.API_INTERNAL_URL || 'http://localhost:4000';
  const res = await fetch(`${baseUrl}/api/auth/verify/${token}`, { cache: 'no-store' });
  const data = await res.json();
  return { ok: res.ok, message: data.message };
}

export default async function VerifyPage({ params }: { params: { token: string } }) {
  const result = await verifyToken(params.token);

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md p-8 rounded-lg shadow-sm border border-gray-100 text-center">
        <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-6 ${result.ok ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
          {result.ok ? (
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
          ) : (
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          )}
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {result.ok ? 'Успішно!' : 'Помилка'}
        </h1>
        <p className="text-gray-600 mb-8">{result.message}</p>

        <Link href="/login" className="inline-block w-full bg-primary text-white py-3 rounded-md font-medium hover:bg-opacity-90 transition-colors">
          Перейти до входу
        </Link>
      </div>
    </main>
  );
}