// app/api/geocode/route.ts
// Naver Geocoding API — 서버에서만 호출 (Client Secret 보호)
import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { apiError } from '@/lib/error-handler';

export async function GET(req: NextRequest) {
  // Rate Limit: IP당 10분에 20건
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? '127.0.0.1';
  if (!rateLimit(ip, { windowMs: 10 * 60 * 1000, max: 20 })) {
    return apiError('RATE_LIMITED', 429);
  }

  const address = req.nextUrl.searchParams.get('address')?.trim();
  if (!address || address.length < 2 || address.length > 100) {
    return apiError('ADDRESS_REQUIRED', 400);
  }

  const clientId     = process.env.NAVER_MAP_CLIENT_ID;
  const clientSecret = process.env.NAVER_MAP_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return apiError('CONFIG_ERROR', 500);
  }

  try {
    const res = await fetch(
      `https://naveropenapi.apigw.ntruss.com/map-geocode/v2/geocode?query=${encodeURIComponent(address)}`,
      {
        headers: {
          'X-NCP-APIGW-API-KEY-ID': clientId,
          'X-NCP-APIGW-API-KEY':    clientSecret,
        },
        // 타임아웃 5초
        signal: AbortSignal.timeout(5000),
      }
    );

    if (!res.ok) return apiError('GEOCODE_FAILED', 502);

    const data = await res.json();
    const item = data.addresses?.[0];

    if (!item) {
      return NextResponse.json({ success: false, message: '주소를 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      lat: parseFloat(item.y),
      lng: parseFloat(item.x),
      roadAddress:   item.roadAddress   ?? '',
      jibunAddress:  item.jibunAddress  ?? '',
    });

  } catch (err) {
    return apiError('GEOCODE_FAILED', 500, err);
  }
}
