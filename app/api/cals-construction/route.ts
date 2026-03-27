// app/api/cals-construction/route.ts
// ────────────────────────────────────────────────────────────
// 소음 환경 데이터 — OpenStreetMap Overpass API
//
// 반환 데이터:
//   count         — 공사 현장 수
//   entertainment — 유흥업소 수
//   traffic       — 간선도로 근접 여부
//   pins          — 지도 핀용 좌표+타입 목록 (방안 B 적용)
// ────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { apiError } from '@/lib/error-handler';

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
      if (text.startsWith('<') && text.includes('Error')) continue;
      return JSON.parse(text);
    } catch {
      continue;
    }
  }
  return null;
}

// OSM element에서 좌표 추출 (node: lat/lon 직접, way: center 객체)
function getCoords(e: any): { lat: number; lng: number } | null {
  if (e.lat != null && e.lon != null) return { lat: e.lat, lng: e.lon };
  if (e.center?.lat != null)          return { lat: e.center.lat, lng: e.center.lon };
  return null;
}

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? '127.0.0.1';
  if (!rateLimit(ip, { windowMs: 10 * 60 * 1000, max: 30 })) {
    return apiError('RATE_LIMITED', 429);
  }

  const lat = parseFloat(req.nextUrl.searchParams.get('lat') ?? '37.5665');
  const lng = parseFloat(req.nextUrl.searchParams.get('lng') ?? '126.9780');

  if (isNaN(lat) || isNaN(lng) || lat < 33 || lat > 39 || lng < 124 || lng > 132) {
    return NextResponse.json({ success: true, count: 0, entertainment: 0, traffic: false, names: [], pins: [] });
  }

  const query = `
[out:json][timeout:15];
(
  way["landuse"="construction"](around:1500,${lat},${lng});
  way["building"="construction"](around:1500,${lat},${lng});
  way["highway"="construction"](around:1500,${lat},${lng});
  node["amenity"~"^(bar|nightclub|pub|karaoke_box)$"](around:800,${lat},${lng});
  way["highway"~"^(motorway|trunk|primary)$"](around:200,${lat},${lng});
);
out tags center 100;
`.trim();

  try {
    const data = await queryOverpass(query);

    if (!data?.elements) {
      return NextResponse.json({ success: true, count: 0, entertainment: 0, traffic: false, names: [], pins: [] });
    }

    const elements: any[] = data.elements;

    const constructions = elements.filter(
      (e: any) => e.type === 'way' &&
        (e.tags?.landuse === 'construction' ||
         e.tags?.building === 'construction' ||
         e.tags?.highway === 'construction'),
    );

    const entertainmentItems = elements.filter(
      (e: any) => e.type === 'node' &&
        ['bar', 'nightclub', 'pub', 'karaoke_box'].includes(e.tags?.amenity ?? ''),
    );

    const hasHighTraffic = elements.some(
      (e: any) => e.type === 'way' &&
        ['motorway', 'trunk', 'primary'].includes(e.tags?.highway ?? ''),
    );

    const names = constructions
      .map((e: any) => e.tags?.name ?? e.tags?.['name:ko'] ?? '')
      .filter(Boolean)
      .slice(0, 5);

    // ── 지도 핀용 좌표 목록 ──────────────────────────────────
    type OsmPin = { lat: number; lng: number; osm_type: string; name: string };
    const pins: OsmPin[] = [];

    for (const e of constructions) {
      const coords = getCoords(e);
      if (coords) pins.push({
        ...coords,
        osm_type: 'construction',
        name: e.tags?.name ?? e.tags?.['name:ko'] ?? '공사 현장',
      });
    }

    for (const e of entertainmentItems) {
      const coords = getCoords(e);
      if (coords) pins.push({
        ...coords,
        osm_type: 'entertainment',
        name: e.tags?.name ?? e.tags?.['name:ko'] ?? e.tags?.amenity ?? '유흥업소',
      });
    }

    return NextResponse.json({
      success:       true,
      count:         constructions.length,
      entertainment: entertainmentItems.length,
      traffic:       hasHighTraffic,
      names,
      pins,
    });

  } catch {
    return NextResponse.json({ success: true, count: 0, entertainment: 0, traffic: false, names: [], pins: [] });
  }
}
