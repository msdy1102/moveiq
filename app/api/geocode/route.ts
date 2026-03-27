// app/api/geocode/route.ts
// Naver Geocoding + Reverse Geocoding API — 서버에서만 호출 (Client Secret 보호)
//
// GET ?address=마포구 성산동       → 주소 → 좌표 (Geocoding)
// GET ?lat=37.57&lng=126.92       → 좌표 → 주소 (Reverse Geocoding)
import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { apiError } from '@/lib/error-handler';

export async function GET(req: NextRequest) {
  // Rate Limit: IP당 10분에 30건 (클릭마다 호출되므로 기존 20→30으로 상향)
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? '127.0.0.1';
  if (!rateLimit(ip, { windowMs: 10 * 60 * 1000, max: 30 })) {
    return apiError('RATE_LIMITED', 429);
  }

  const clientId     = process.env.NAVER_MAP_CLIENT_ID;
  const clientSecret = process.env.NAVER_MAP_CLIENT_SECRET;
  if (!clientId || !clientSecret) return apiError('CONFIG_ERROR', 500);

  const params  = req.nextUrl.searchParams;
  const address = params.get('address')?.trim();
  const latStr  = params.get('lat');
  const lngStr  = params.get('lng');

  // ── 역지오코딩: 좌표 → 주소 ─────────────────────────────
  if (latStr && lngStr) {
    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);
    if (isNaN(lat) || isNaN(lng)) return apiError('INVALID_COORDS', 400);

    try {
      const res = await fetch(
        `https://naveropenapi.apigw.ntruss.com/map-reversegeocode/v2/gc` +
        `?coords=${lng},${lat}&sourcecrs=epsg:4326&orders=roadaddr,addr&output=json`,
        {
          headers: {
            'X-NCP-APIGW-API-KEY-ID': clientId,
            'X-NCP-APIGW-API-KEY':    clientSecret,
          },
          signal: AbortSignal.timeout(5000),
        }
      );

      if (!res.ok) return apiError('REVERSE_GEOCODE_FAILED', 502);

      const data    = await res.json();
      const results = data.results ?? [];

      // roadaddr 우선, 없으면 addr(지번) 사용
      const road  = results.find((r: any) => r.name === 'roadaddr');
      const addr  = results.find((r: any) => r.name === 'addr');
      const item  = road ?? addr;

      if (!item) {
        return NextResponse.json({ success: false, message: '주소를 찾을 수 없습니다.' }, { status: 404 });
      }

      // 도로명 주소 조합
      const region = item.region;
      const land   = item.land;
      let   roadAddress = '';

      if (item.name === 'roadaddr' && land) {
        roadAddress = [
          region?.area1?.name,
          region?.area2?.name,
          land?.name,
          land?.number1 ? `${land.number1}${land.number2 ? `-${land.number2}` : ''}` : '',
        ].filter(Boolean).join(' ');
      } else if (item.name === 'addr' && land) {
        roadAddress = [
          region?.area1?.name,
          region?.area2?.name,
          region?.area3?.name,
          land?.number1 ? `${land.number1}${land.number2 ? `-${land.number2}` : ''}` : '',
        ].filter(Boolean).join(' ');
      }

      return NextResponse.json({
        success:     true,
        lat,
        lng,
        roadAddress,
        jibunAddress: roadAddress, // 역지오코딩은 단일 주소 반환
      });

    } catch (err) {
      return apiError('REVERSE_GEOCODE_FAILED', 500, err);
    }
  }

  // ── 일반 지오코딩: 주소 → 좌표 ──────────────────────────
  if (!address || address.length < 2 || address.length > 100) {
    return apiError('ADDRESS_REQUIRED', 400);
  }

  try {
    const res = await fetch(
      `https://naveropenapi.apigw.ntruss.com/map-geocode/v2/geocode?query=${encodeURIComponent(address)}`,
      {
        headers: {
          'X-NCP-APIGW-API-KEY-ID': clientId,
          'X-NCP-APIGW-API-KEY':    clientSecret,
        },
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
      success:      true,
      lat:          parseFloat(item.y),
      lng:          parseFloat(item.x),
      roadAddress:  item.roadAddress  ?? '',
      jibunAddress: item.jibunAddress ?? '',
    });

  } catch (err) {
    return apiError('GEOCODE_FAILED', 500, err);
  }
}
