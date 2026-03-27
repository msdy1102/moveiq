// app/api/cals-construction/route.ts
// 건설CALS 진행중 공사 현황 조회
import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { apiError } from '@/lib/error-handler';

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? '127.0.0.1';
  if (!rateLimit(ip, { windowMs: 10 * 60 * 1000, max: 30 })) {
    return apiError('RATE_LIMITED', 429);
  }

  const lat = parseFloat(req.nextUrl.searchParams.get('lat') ?? '37.5665');
  const lng = parseFloat(req.nextUrl.searchParams.get('lng') ?? '126.9780');

  const key = process.env.CALS_API_KEY;
  if (!key) {
    return NextResponse.json({ success: true, count: 0, names: [] });
  }

  try {
    const res = await fetch(
      `https://www.calspia.go.kr/openApiSvc/selectConstrWrkList` +
      `?authKey=${key}&lat=${lat}&lon=${lng}&radius=1000` +
      `&wrkStts=ING&pageNo=1&numOfRows=20`,
      { signal: AbortSignal.timeout(6000) }
    );

    if (!res.ok) {
      return NextResponse.json({ success: true, count: 0, names: [] });
    }

    const data = await res.json();
    const items: any[] = data?.list ?? data?.items ?? data?.data ?? [];

    const names = items
      .map((i: any) => i.constrWrkNm ?? i.wrkNm ?? i.constrNm ?? '')
      .filter(Boolean)
      .slice(0, 5);

    return NextResponse.json({
      success: true,
      count: items.length,
      names,
    });

  } catch {
    // CALS API 실패 시 빈 결과 반환 (서비스 중단 방지)
    return NextResponse.json({ success: true, count: 0, names: [] });
  }
}
