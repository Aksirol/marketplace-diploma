/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:4000/api/:path*', // Вказуємо порт твого бекенду
      },
    ];
  },
};

export default nextConfig;