// app/analysis/share/[token]/page.tsx
// 공유된 분석 결과 뷰 페이지 (읽기 전용)
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import SharedReportClient from './SharedReportClient';

interface Props { params: { token: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  // 서버에서 토큰 유효성만 빠르게 검증
  if (!/^[a-f0-9]{16}$/.test(params.token)) {
    return { title: '잘못된 공유 링크 | 무브IQ' };
  }

  return {
    title:       '분석 리포트 공유 | 무브IQ',
    description: '무브IQ AI 입지 분석 공유 리포트입니다. 소음·학군·교통·상권·개발계획을 한 번에 확인하세요.',
    openGraph: {
      title:    '무브IQ 분석 리포트 공유',
      description: '이 동네 이사 괜찮을까? AI가 6개 레이어로 분석한 결과를 확인하세요.',
      type:     'website',
      locale:   'ko_KR',
    },
  };
}

export default function SharedReportPage({ params }: Props) {
  if (!/^[a-f0-9]{16}$/.test(params.token)) notFound();
  return <SharedReportClient token={params.token} />;
}
