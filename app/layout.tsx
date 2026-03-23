import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '무브IQ — 이사 전, 이것만 보면 끝',
  description: '소음 크라우드 지도 × AI 입지 분석 — 이사 결정에 필요한 모든 데이터를 한 화면에서',
  keywords: '이사, 입지분석, 층간소음, 소음지도, 부동산, 학군, 상권',
  openGraph: {
    title: '무브IQ — 이사 전, 이것만 보면 끝',
    description: '소음 크라우드 지도 × AI 입지 분석',
    type: 'website',
    locale: 'ko_KR',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700;900&family=Space+Mono:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
