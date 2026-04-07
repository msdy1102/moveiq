import { MetadataRoute } from 'next';
import { KOREA_DONGS } from '@/lib/korea-dongs';

const BASE_URL = 'https://moveiq.vercel.app';

// 서울 주요 동 — SEO 핵심 타겟 (이사 수요 높은 지역 우선)
const PRIORITY_DONGS = new Set([
  '마포구_성산동', '마포구_합정동', '마포구_망원동', '마포구_홍대입구',
  '강남구_역삼동', '강남구_압구정동', '강남구_청담동', '강남구_삼성동',
  '서초구_방배동', '서초구_잠원동', '서초구_반포동',
  '송파구_잠실동', '송파구_방이동', '송파구_석촌동',
  '용산구_한남동', '용산구_이태원1동', '용산구_이촌1동',
  '성동구_성수1가1동', '성동구_옥수동',
  '광진구_자양1동', '광진구_화양동',
  '동작구_상도동', '동작구_흑석동',
  '영등포구_여의도동', '영등포구_당산동',
  '강서구_화곡동', '강서구_등촌동',
]);

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date().toISOString();

  // 정적 주요 페이지
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/analysis`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/noise-map`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/community`,
      lastModified: now,
      changeFrequency: 'hourly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/legal/terms`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/legal/privacy`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ];

  // 동네별 정적 SEO 페이지
  // slug 형태: /analysis/서울-마포구-성산동
  const dongPages: MetadataRoute.Sitemap = KOREA_DONGS.map(([sido, sigungu, dong]) => {
    const slug = encodeURIComponent(`${sido}-${sigungu}-${dong}`);
    const key = `${sigungu}_${dong}`;
    const isPriority = PRIORITY_DONGS.has(key);

    return {
      url: `${BASE_URL}/analysis/${slug}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: isPriority ? 0.8 : 0.5,
    };
  });

  return [...staticPages, ...dongPages];
}
