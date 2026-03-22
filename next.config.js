/** @type {import('next').NextConfig} */
const nextConfig = {
  // 소스맵 운영 환경 비공개 (보안)
  productionBrowserSourceMaps: false,

  // 보안 헤더
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options',         value: 'DENY' },
          { key: 'X-Content-Type-Options',   value: 'nosniff' },
          { key: 'Referrer-Policy',          value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy',       value: 'camera=(), microphone=(), geolocation=(self)' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          // X-Powered-By 는 Next.js 가 자동 제거 (poweredByHeader: false)
        ],
      },
    ];
  },

  poweredByHeader: false,
};

module.exports = nextConfig;
