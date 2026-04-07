/** @type {import('next').NextConfig} */
const nextConfig = {
  // 소스맵 운영 환경 비공개 (보안)
  productionBrowserSourceMaps: false,
  poweredByHeader: false,

  async headers() {
    return [
      // ── 전체 페이지 보안 헤더 ──────────────────────────────
      {
        source: '/(.*)',
        headers: [
          // Clickjacking 방지
          { key: 'X-Frame-Options',       value: 'DENY' },
          // MIME 스니핑 방지
          { key: 'X-Content-Type-Options',value: 'nosniff' },
          // Referer 정보 최소화
          { key: 'Referrer-Policy',       value: 'strict-origin-when-cross-origin' },
          // 불필요한 브라우저 기능 차단 (카메라/마이크 제한, geolocation self만 허용)
          { key: 'Permissions-Policy',    value: 'camera=(), microphone=(), geolocation=(self)' },
          // HTTPS 강제 (2년, preload 포함)
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          // ── Content Security Policy ──────────────────────
          // - default-src: self만 허용
          // - script-src:  self + naver maps SDK + kakao SDK
          // - style-src:   self + unsafe-inline (CSS Modules 인라인 스타일)
          // - img-src:     self + data URI + Supabase Storage + Naver Maps 타일
          // - connect-src: self + Supabase API + Anthropic API (서버→서버지만 edge runtime 대비)
          // - frame-src:   DENY (iframe 완전 차단)
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // 네이버 지도 SDK (nrbe = 지도 타일 스크립트 포함) + 카카오 SDK + Pretendard CDN
              "script-src 'self' https://oapi.map.naver.com https://openapi.map.naver.com https://ssl.pstatic.net https://nrbe.pstatic.net https://nid.naver.com https://developers.kakao.com https://t1.kakaocdn.net https://cdn.jsdelivr.net 'unsafe-inline' 'unsafe-eval'",
              // Pretendard CSS (jsdelivr) + 네이버 지도 인라인 스타일
              "style-src 'self' 'unsafe-inline' https://ssl.pstatic.net https://cdn.jsdelivr.net",
              // 네이버 지도 타일 (nrbe.pstatic.net) + 구글 프로필 사진 + Supabase Storage
              "img-src 'self' data: blob: https://*.supabase.co https://ssl.pstatic.net https://nrbe.pstatic.net https://*.map.naver.net https://map.pstatic.net https://ldb.pstatic.net https://naver-map.pstatic.net https://lh3.googleusercontent.com https://t1.kakaocdn.net",
              // 웹폰트 (jsdelivr Pretendard woff2 포함)
              "font-src 'self' data: https://ssl.pstatic.net https://cdn.jsdelivr.net",
              // 네이버 지도 내부 로깅 + XHR/fetch 전체
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://oapi.map.naver.com https://openapi.map.naver.com https://naveropenapi.apigw.ntruss.com https://map.naver.com https://kr-col-ext.nelo.navercorp.com https://overpass-api.de https://overpass.openstreetmap.ru https://api.resend.com https://api.tosspayments.com",
              // 네이버 지도 Web Worker
              "worker-src 'self' blob:",
              "frame-src 'none'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "upgrade-insecure-requests",
            ].join('; '),
          },
        ],
      },

      // ── API 라우트: 캐시 완전 비활성화 ───────────────────
      // CDN/프록시가 민감한 API 응답을 캐시하는 것을 방지
      {
        source: '/api/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, proxy-revalidate' },
          { key: 'Pragma',        value: 'no-cache' },
          { key: 'Expires',       value: '0' },
        ],
      },

      // ── OG 이미지: 엣지 캐시 허용 (1시간) ────────────────
      {
        source: '/api/og',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=3600, s-maxage=3600' },
        ],
      },

      // ── 공유 페이지: 보안 강화 (iframe 불허) ─────────────
      {
        source: '/analysis/share/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Cache-Control',   value: 'no-store' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
