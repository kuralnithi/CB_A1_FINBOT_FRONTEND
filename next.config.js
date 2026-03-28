/** @type {import('next').NextConfig} */
const nextConfig = {
  // Netlify manages its own build output efficiently
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        // Fallback for local dev, but in production we'll use NEXT_PUBLIC_API_URL
        destination: process.env.NODE_ENV === 'development' 
          ? 'http://localhost:8000/api/:path*' 
          : 'http://localhost:8000/api/:path*', 
      },
    ];
  },
};

module.exports = nextConfig;
