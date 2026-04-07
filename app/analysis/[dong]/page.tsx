import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { KOREA_DONGS } from '@/lib/korea-dongs';

// ── 타입 ─────────────────────────────────────────────────────────
interface ParsedDong {
  sido: string;
  sigungu: string;
  dong: string;
}

// ── slug 파싱 ─────────────────────────────────────────────────────
function parseSlug(slug: string): ParsedDong | null {
  const decoded = decodeURIComponent(slug);
  // 형태: "서울-마포구-성산동"
  const parts = decoded.split('-');
  if (parts.length < 3) return null;

  const sido = parts[0];
  const sigungu = parts[1];
  const dong = parts.slice(2).join('-'); // 동 이름에 하이픈 있을 경우 대비

  // KOREA_DONGS에 존재하는지 검증
  const exists = KOREA_DONGS.some(
    ([s, sg, d]) => s === sido && sg === sigungu && d === dong
  );
  if (!exists) return null;

  return { sido, sigungu, dong };
}

// ── SEO: 동네별 메타데이터 ────────────────────────────────────────
export async function generateMetadata({
  params,
}: {
  params: { dong: string };
}): Promise<Metadata> {
  const parsed = parseSlug(params.dong);
  if (!parsed) {
    return { title: '동네를 찾을 수 없습니다 | 무브IQ' };
  }

  const { sido, sigungu, dong } = parsed;
  const fullName = `${sido} ${sigungu} ${dong}`;
  const shortName = `${sigungu} ${dong}`;

  const title = `${shortName} 이사 괜찮을까? 소음·입지 분석 | 무브IQ`;
  const description = `${fullName} 이사 전 꼭 확인하세요. 층간소음 이력, 야간 유흥가 소음, 공사 현황, 학군·마트·병원 거리, 전세사기 위험도까지 AI가 3분 만에 분석합니다. 무브IQ에서 무료로 확인하세요.`;

  return {
    title,
    description,
    keywords: [
      `${shortName} 이사`,
      `${shortName} 입지분석`,
      `${shortName} 소음`,
      `${shortName} 층간소음`,
      `${shortName} 학군`,
      `${shortName} 전세`,
      `${sigungu} 이사`,
      '부동산 입지분석',
      '이사 소음 확인',
      '무브IQ',
    ],
    openGraph: {
      title,
      description,
      url: `https://moveiq.vercel.app/analysis/${params.dong}`,
      type: 'website',
      locale: 'ko_KR',
      siteName: '무브IQ',
      images: [
        {
          url: `https://moveiq.vercel.app/api/og?dong=${encodeURIComponent(fullName)}`,
          width: 1200,
          height: 630,
          alt: `${fullName} 입지 분석 | 무브IQ`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    alternates: {
      canonical: `https://moveiq.vercel.app/analysis/${params.dong}`,
    },
  };
}

// ── 정적 경로 사전 생성 (상위 100개 우선 — Vercel 빌드 시간 최적화) ──
export async function generateStaticParams() {
  // 전체를 생성하면 1,000+개 — Vercel Hobby 플랜에서 빌드 시간이 길어질 수 있음
  // 서울 전체 + 주요 광역시 핵심 동 우선 정적 생성, 나머지는 ISR(on-demand)
  const PRIORITY_SIDO = ['서울', '부산', '인천', '대구', '광주', '대전', '울산'];

  const priorityDongs = KOREA_DONGS.filter(([sido]) =>
    PRIORITY_SIDO.includes(sido)
  );

  return priorityDongs.map(([sido, sigungu, dong]) => ({
    dong: encodeURIComponent(`${sido}-${sigungu}-${dong}`),
  }));
}

// ISR: 존재하는 동이면 on-demand로 생성, 7일마다 재검증
export const revalidate = 604800; // 7일 (초)
export const dynamicParams = true; // generateStaticParams 외 동도 허용

// ── 페이지 컴포넌트 ───────────────────────────────────────────────
export default function DongSeoPage({
  params,
}: {
  params: { dong: string };
}) {
  const parsed = parseSlug(params.dong);

  if (!parsed) {
    notFound();
  }

  const { sido, sigungu, dong } = parsed;
  const fullAddress = `${sigungu} ${dong}`;

  // 분석 페이지로 주소를 searchParam으로 넘겨 리디렉션
  // Next.js 서버 컴포넌트에서 redirect() 사용
  redirect(`/analysis?address=${encodeURIComponent(fullAddress)}`);
}
