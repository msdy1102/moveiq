// app/api/cals-construction/route.ts
// ────────────────────────────────────────────────────────────
// 소음 환경 데이터 — OpenStreetMap Overpass API
//
// [마이그레이션 사유]
// 건설CALS (calspia.go.kr) 및 브이월드 (api.vworld.kr) 는
// Vercel 서버리스 환경(해외 IP)에서 502/503/404로 접근 차단됨.
// 동일 데이터를 무료·무인증·IP 제한 없는 OSM Overpass API로 대체.
//
// 수집 데이터:
//   construction  — 반경 내 공사 현장 수
//   entertainment — 유흥업소 수 (bar, nightclub, pub, karaoke_box)
//   traffic       — 간선도로 근접 여부 (motorway, trunk, primary)
// ────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { apiError } from '@/lib/error-handler';

// Overpass API 미러 목록 (순서대로 폴백)
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.openstreetmap.ru/api/interpreter',
];

async function queryOverpass(query: string): Promise<any> {
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) continue;
      const text = await res.text();
      // XML 에러 응답 필터
      if (text.startsWith('<') && text.includes('Error')) continue;
      return JSON.parse(text);
    } catch {
      continue;
    }
  }
  return null;
}

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? '127.0.0.1';
  if (!rateLimit(ip, { windowMs: 10 * 60 * 1000, max: 30 })) {
    return apiError('RATE_LIMITED', 429);
  }

  const lat = parseFloat(req.nextUrl.searchParams.get('lat') ?? '37.5665');
  const lng = parseFloat(req.nextUrl.searchParams.get('lng') ?? '126.9780');

  // 좌표 유효성 검사 (한국 범위)
  if (isNaN(lat) || isNaN(lng) || lat < 33 || lat > 39 || lng < 124 || lng > 132) {
    return NextResponse.json({ success: true, count: 0, entertainment: 0, traffic: false, names: [] });
  }

  // ── Overpass 쿼리: 공사·유흥·교통 3종 데이터 단일 요청 수집 ──
  const query = `
[out:json][timeout:15];
(
  way["landuse"="construction"](around:1500,${lat},${lng});
  way["building"="construction"](around:1500,${lat},${lng});
  way["highway"="construction"](around:1500,${lat},${lng});
  node["amenity"~"^(bar|nightclub|pub|karaoke_box)$"](around:800,${lat},${lng});
  way["highway"~"^(motorway|trunk|primary)$"](around:200,${lat},${lng});
);
out tags center 50;
`.trim();

  try {
    const data = await queryOverpass(query);

    if (!data?.elements) {
      return NextResponse.json({ success: true, count: 0, entertainment: 0, traffic: false, names: [] });
    }

    const elements: any[] = data.elements;

    // 공사 현장 (way - landuse/building/highway=construction)
    const constructions = elements.filter(
      (e: any) =>
        e.type === 'way' &&
        (e.tags?.landuse === 'construction' ||
          e.tags?.building === 'construction' ||
          e.tags?.highway === 'construction'),
    );

    // 유흥업소 (node - bar/nightclub/pub/karaoke)
    const entertainmentItems = elements.filter(
      (e: any) =>
        e.type === 'node' &&
        ['bar', 'nightclub', 'pub', 'karaoke_box'].includes(e.tags?.amenity ?? ''),
    );

    // 간선도로 근접 여부 (way - motorway/trunk/primary)
    const hasHighTraffic = elements.some(
      (e: any) =>
        e.type === 'way' &&
        ['motorway', 'trunk', 'primary'].includes(e.tags?.highway ?? ''),
    );

    // 공사 현장 이름 (최대 5개)
    const names = constructions
      .map((e: any) => e.tags?.name ?? e.tags?.['name:ko'] ?? '')
      .filter(Boolean)
      .slice(0, 5);

    return NextResponse.json({
      success:       true,
      count:         constructions.length,        // 공사 건수 (page.tsx의 calsJson.count 호환)
      entertainment: entertainmentItems.length,   // 유흥업소 수
      traffic:       hasHighTraffic,              // 간선도로 근접
      names,                                      // 공사 현장명 목록
    });

  } catch {
    return NextResponse.json({ success: true, count: 0, entertainment: 0, traffic: false, names: [] });
  }
}
