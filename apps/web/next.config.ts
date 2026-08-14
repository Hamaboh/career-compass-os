import type { NextConfig } from 'next';

/**
 * Phase3 1.2/13.1節: /api/* はCaddyがNestJS(api)へプロキシするため、
 * Next.js自体はAPIルートを持たず素直にSSR/CSRを提供する構成とする。
 * ローカル単体起動（`npm run dev:web`, Docker外）時のみ、開発用にAPIへリライトする。
 */
const nextConfig: NextConfig = {
  // packages/shared はビルド済み成果物を持たないため、Next.js側でトランスパイルを許可する。
  transpilePackages: ['@career-compass/shared'],
  async rewrites() {
    if (process.env.NODE_ENV !== 'development') return [];
    return [
      {
        source: '/api/:path*',
        destination: `http://localhost:${process.env.API_INTERNAL_PORT ?? 3001}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
