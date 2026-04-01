import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '무브IQ — 이사 후 후회, 42%가 겪는다. 계약 전 3분이면 막을 수 있습니다.',
  description: '소음 크라우드 지도 × AI 입지 분석 — 층간소음 이력, 야간 유흥가 소음, 공사 현황, 학군·인프라·개발계획까지 주소 하나로.',
  keywords: '이사, 입지분석, 층간소음, 소음지도, 부동산, 학군, 상권, 이사후회',
  openGraph: {
    title: '무브IQ — 이사 후 후회, 42%가 겪는다.',
    description: '계약 전 3분이면 막을 수 있습니다.',
    type: 'website',
    locale: 'ko_KR',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
