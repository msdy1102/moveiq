import type { Metadata } from 'next';
import './globals.css';
import Script from 'next/script';

const BASE_URL = 'https://moveiq.vercel.app';

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),

  title: {
    default: '무브IQ — 이사 후 후회, 42%가 겪는다. 계약 전 3분이면 막을 수 있습니다.',
    template: '%s | 무브IQ',
  },
  description:
    '소음 크라우드 지도 × AI 입지 분석 — 층간소음 이력, 야간 유흥가 소음, 공사 현황, 학군·인프라·개발계획까지 주소 하나로 확인하세요.',
  keywords: [
    '이사', '입지분석', '층간소음', '소음지도', '부동산', '학군',
    '상권', '이사후회', '전세사기', '동네분석', 'AI부동산', '무브IQ',
  ],

  openGraph: {
    title: '무브IQ — 이사 후 후회, 42%가 겪는다.',
    description: '계약 전 3분이면 막을 수 있습니다. 소음 크라우드 지도 × AI 입지 분석.',
    url: BASE_URL,
    siteName: '무브IQ',
    type: 'website',
    locale: 'ko_KR',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: '무브IQ — 이사 전, 이것만 보면 끝',
      },
    ],
  },

  twitter: {
    card: 'summary_large_image',
    title: '무브IQ — 이사 후 후회, 42%가 겪는다.',
    description: '계약 전 3분이면 막을 수 있습니다. 소음 크라우드 지도 × AI 입지 분석.',
    images: ['/opengraph-image'],
  },

  alternates: {
    canonical: BASE_URL,
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },

  verification: {
    google: 'YyzxirHYgaDQ4HWGPaDuTKkxYYp2xt5TbepQmla4m8c',
  },

  // ── PWA ──────────────────────────────────────────────────
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: '무브IQ',
  },
  formatDetection: { telephone: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        {/* PWA theme-color */}
        <meta name="theme-color" content="#646F4B" />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#3d4a2e" />
        {/* iOS PWA */}
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/icons/icon-152.png" />
        <link rel="apple-touch-icon" sizes="144x144" href="/icons/icon-144.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="무브IQ" />
        {/* MS Tile */}
        <meta name="msapplication-TileColor" content="#646F4B" />
        <meta name="msapplication-TileImage" content="/icons/icon-144.png" />
      </head>
      <body>
        {children}

        {/* Service Worker 등록 */}
        <Script
          id="sw-register"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js', { scope: '/' })
                    .then(function(reg) {
                      reg.addEventListener('updatefound', function() {
                        var nw = reg.installing;
                        if (nw) nw.addEventListener('statechange', function() {
                          if (nw.state === 'installed' && navigator.serviceWorker.controller)
                            nw.postMessage({ type: 'SKIP_WAITING' });
                        });
                      });
                    })
                    .catch(function(e) { console.warn('SW 등록 실패:', e); });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
