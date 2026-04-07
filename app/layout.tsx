import type { Metadata } from 'next';
import './globals.css';

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
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
