// app/api/dong-search/route.ts
// 동네(읍면동) 자동완성 — Naver Geocoding으로 실존 여부 검증
import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { apiError } from '@/lib/error-handler';

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? '127.0.0.1';
  if (!rateLimit(ip, { windowMs: 60 * 1000, max: 30 })) return apiError('RATE_LIMITED', 429);

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (!q || q.length < 2) return NextResponse.json({ success: true, results: [] });

  const clientId     = process.env.NAVER_MAP_CLIENT_ID;
  const clientSecret = process.env.NAVER_MAP_CLIENT_SECRET;
  if (!clientId || !clientSecret) return apiError('CONFIG_ERROR', 500);

  try {
    // Naver Geocoding으로 입력값 + "동" 검색
    const query = q.endsWith('동') || q.endsWith('읍') || q.endsWith('면') ? q : `${q}`;
    const res = await fetch(
      `https://naveropenapi.apigw.ntruss.com/map-geocode/v2/geocode?query=${encodeURIComponent(query)}&count=5`,
      {
        headers: {
          'X-NCP-APIGW-API-KEY-ID': clientId,
          'X-NCP-APIGW-API-KEY':    clientSecret,
        },
        signal: AbortSignal.timeout(4000),
      }
    );

    if (!res.ok) return NextResponse.json({ success: true, results: [] });

    const data = await res.json();
    const addresses: any[] = data.addresses ?? [];

    // 읍면동 레벨까지만 추출 (도로명/번지 제외)
    const seen = new Set<string>();
    const results: { label: string; lat: number; lng: number }[] = [];

    for (const item of addresses) {
      // jibunAddress에서 구+동 추출
      const parts = (item.jibunAddress || item.roadAddress || '').split(' ');
      // "서울특별시 마포구 성산동" 형태에서 마지막 행정구역 단위까지
      const dongIdx = parts.findIndex((p: string) =>
        p.endsWith('동') || p.endsWith('읍') || p.endsWith('면') || p.endsWith('리')
      );
      if (dongIdx < 0) continue;
      const label = parts.slice(0, dongIdx + 1).join(' ');
      if (seen.has(label)) continue;
      seen.add(label);
      results.push({ label, lat: parseFloat(item.y), lng: parseFloat(item.x) });
      if (results.length >= 5) break;
    }

    return NextResponse.json({ success: true, results });
  } catch {
    return NextResponse.json({ success: true, results: [] });
  }
}
