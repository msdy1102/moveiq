// app/api/analyze/route.ts — v4
// 캐시 히트/미스 모두 analysis_history에 저장 (유저/세션별)
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { rateLimit } from '@/lib/rate-limit';
import { apiError } from '@/lib/error-handler';
import { createServiceClient } from '@/lib/supabase';
import { fetchPublicData } from '@/lib/public-data';

function getAnthropic() {
  const key = process.env.CLAUDE_API_KEY;
  if (!key) throw new Error('CLAUDE_API_KEY 환경변수가 설정되지 않았습니다.');
  return new Anthropic({ apiKey: key });
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? '127.0.0.1';
  if (!rateLimit(ip, { windowMs: 10 * 60 * 1000, max: 5 })) {
    return apiError('RATE_LIMITED', 429);
  }

  let body: { address?: string; session_id?: string };
  try { body = await req.json(); } catch { return apiError('INVALID_INPUT', 400); }

  const address    = body.address?.trim();
  const session_id = body.session_id?.trim() ?? null;

  if (!address || address.length < 2 || address.length > 100) {
    return apiError('ADDRESS_REQUIRED', 400);
  }

  try {
    const supabase = createServiceClient();

    // ── 1. 캐시 확인 (24시간) ───────────────────────────────
    const { data: cached } = await supabase
      .from('analysis_cache')
      .select('result, created_at')
      .eq('address', address)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .single();

    let result: any;
    let isCached = false;

    if (cached?.result) {
      result   = cached.result;
      isCached = true;
    } else {
      // ── 2. 신규 분석 ─────────────────────────────────────
      const naverData  = await fetchNaverFacilities(address);
      const noiseData  = naverData ? await fetchNoiseReports(supabase, naverData._lat, naverData._lng) : null;
      const publicData = naverData ? await fetchPublicData(naverData._lat, naverData._lng, address) : null;

      result = await runClaudeAnalysis(address, naverData, noiseData, publicData);

      // 캐시 저장
      try {
        await supabase.from('analysis_cache').upsert({ address, result, created_at: new Date().toISOString() });
      } catch (e) { console.error('[analyze] 캐시 저장 오류:', e); }
    }

    // ── 3. 히스토리 저장 (session_id 있을 때만) ────────────
    if (session_id) {
      try {
        await supabase.from('analysis_history').insert({
          session_id,
          address,
          result,
          total_score: result?.total ?? null,
          grade:       result?.grade ?? null,
          cached:      isCached,
        });
      } catch (e) { console.error('[analyze] 히스토리 저장 오류:', e); }
    }

    return NextResponse.json({ success: true, data: result, cached: isCached });
  } catch (err) {
    return apiError('ANALYSIS_FAILED', 500, err);
  }
}

// ── 히스토리 조회 (마이페이지 연동) ──────────────────────────
export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? '127.0.0.1';
  if (!rateLimit(ip, { windowMs: 60 * 1000, max: 30 })) return apiError('RATE_LIMITED', 429);

  const sessionId = req.nextUrl.searchParams.get('session_id');
  if (!sessionId) return apiError('SESSION_REQUIRED', 400);

  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from('analysis_history')
      .select('id, address, total_score, grade, created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(50);

    return NextResponse.json({ success: true, data: data ?? [] });
  } catch {
    return NextResponse.json({ success: true, data: [] });
  }
}

// ═══════════════════════════════════════════════════════
// 이하 기존 헬퍼 함수 (변경 없음)
// ═══════════════════════════════════════════════════════

async function fetchNaverFacilities(address: string): Promise<(Record<string, number> & { _lat: number; _lng: number }) | null> {
  const clientId     = process.env.NAVER_MAP_CLIENT_ID;
  const clientSecret = process.env.NAVER_MAP_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const headers = {
    'X-NCP-APIGW-API-KEY-ID': clientId,
    'X-NCP-APIGW-API-KEY':    clientSecret,
  };

  let lat: number, lng: number;
  try {
    const geoRes = await fetch(
      `https://naveropenapi.apigw.ntruss.com/map-geocode/v2/geocode?query=${encodeURIComponent(address)}`,
      { headers, signal: AbortSignal.timeout(5000) }
    );
    const geoData = await geoRes.json();
    const item = geoData.addresses?.[0];
    if (!item) return null;
    lat = parseFloat(item.y);
    lng = parseFloat(item.x);
  } catch { return null; }

  const keywords = [
    { keyword: '지하철역', label: '지하철역' }, { keyword: '병원',     label: '병원'     },
    { keyword: '약국',     label: '약국'     }, { keyword: '대형마트', label: '대형마트' },
    { keyword: '편의점',   label: '편의점'   }, { keyword: '초등학교', label: '학교'     },
    { keyword: '카페',     label: '카페'     }, { keyword: '공원',     label: '공원'     },
  ];

  const results: Record<string, number> & { _lat: number; _lng: number } = { _lat: lat, _lng: lng };

  await Promise.all(keywords.map(async ({ keyword, label }) => {
    try {
      const res = await fetch(
        `https://naveropenapi.apigw.ntruss.com/map-place/v1/search?query=${encodeURIComponent(keyword)}&coordinate=${lng},${lat}&radius=1000&count=15`,
        { headers, signal: AbortSignal.timeout(5000) }
      );
      const data = await res.json();
      results[label] = data.places?.length ?? 0;
    } catch { results[label] = 0; }
  }));

  return results;
}

interface NoiseStats {
  total: number;
  by_type: Record<string, number>;
  by_time: Record<string, number>;
  avg_severity: number;
  recent_30d: number;
}

async function fetchNoiseReports(supabase: any, lat: number, lng: number): Promise<NoiseStats | null> {
  try {
    const delta = 0.009;
    const { data, error } = await supabase
      .from('noise_reports')
      .select('noise_type, time_slot, severity, created_at, lat, lng')
      .gte('lat', lat - delta).lte('lat', lat + delta)
      .gte('lng', lng - delta).lte('lng', lng + delta)
      .gte('created_at', new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString())
      .limit(500);

    if (error || !data?.length) return null;

    const nearby = data.filter((r: any) => {
      const dlat = (r.lat - lat) * 111000;
      const dlng = (r.lng - lng) * 111000 * Math.cos(lat * Math.PI / 180);
      return Math.sqrt(dlat * dlat + dlng * dlng) <= 1000;
    });

    if (!nearby.length) return null;

    const by_type: Record<string, number> = {};
    const by_time: Record<string, number> = {};
    let severity_sum = 0;
    const cutoff_30d = Date.now() - 30 * 24 * 60 * 60 * 1000;
    let recent_30d = 0;

    nearby.forEach((r: any) => {
      by_type[r.noise_type] = (by_type[r.noise_type] ?? 0) + 1;
      by_time[r.time_slot]  = (by_time[r.time_slot]  ?? 0) + 1;
      severity_sum += r.severity;
      if (new Date(r.created_at).getTime() > cutoff_30d) recent_30d++;
    });

    return { total: nearby.length, by_type, by_time,
      avg_severity: Math.round((severity_sum / nearby.length) * 10) / 10, recent_30d };
  } catch { return null; }
}

async function runClaudeAnalysis(
  address: string,
  facilities: (Record<string, number> & { _lat?: number; _lng?: number }) | null,
  noiseStats: NoiseStats | null,
  publicData: import('@/lib/public-data').PublicDataResult | null,
) {
  const facilityStr = facilities
    ? Object.entries(facilities).filter(([k]) => !k.startsWith('_')).map(([k, v]) => `${k}: ${v}개`).join(', ')
    : '시설 데이터 없음';

  const TYPE_KO: Record<string, string> = { construction:'공사', entertainment:'유흥', floor:'층간', traffic:'교통', other:'기타' };
  const TIME_KO: Record<string, string> = { dawn:'새벽', morning:'오전', afternoon:'오후', evening:'저녁', night:'심야' };

  const noiseStr = noiseStats
    ? [`총 제보 ${noiseStats.total}건 (최근 30일 ${noiseStats.recent_30d}건)`,
       `평균 심각도 ${noiseStats.avg_severity}/5`,
       `유형별: ${Object.entries(noiseStats.by_type).map(([k,v])=>`${TYPE_KO[k]??k} ${v}건`).join(', ')}`,
       `시간대별: ${Object.entries(noiseStats.by_time).map(([k,v])=>`${TIME_KO[k]??k} ${v}건`).join(', ')}`,
      ].join(' / ')
    : '제보 데이터 없음 (조용한 지역이거나 데이터 미수집)';

  const publicStr       = publicData?.summary ?? '공공데이터 없음';
  const constructionStr = publicData && publicData.active_constructions > 0
    ? `현재 진행중 공사 ${publicData.active_constructions}건`
      + (publicData.construction_details.length ? `: ${publicData.construction_details.join(', ')}` : '')
    : '현재 진행중 공사 없음';

  const prompt = `당신은 한국 부동산 입지 분석 전문가입니다.
다음 주소에 대해 이사 결정자 관점에서 입지를 분석해 주세요.

주소: ${address}
반경 1km 시설 현황 (네이버): ${facilityStr}
반경 1km 실제 소음 제보: ${noiseStr}
주변 공사 현황 (건설CALS): ${constructionStr}
공간정보·도시계획·거래 데이터 (브이월드·data.go.kr): ${publicStr}

아래 JSON 형식으로 정확히 응답하세요. JSON 외 다른 텍스트는 절대 포함하지 마세요.

{
  "address": "${address}",
  "scores": {
    "traffic": <교통접근성 0-100>,
    "infra": <생활인프라 0-100>,
    "school": <학군환경 0-100>,
    "noise": <소음환경 0-100 — 높을수록 조용>,
    "commerce": <상권활성도 0-100>,
    "development": <개발잠재력 0-100>
  },
  "total": <종합점수 0-100>,
  "grade": "<S/A+/A/A-/B+/B/B-/C+/C/D>",
  "ai_comment": "<핵심 강약점 2~3문장>",
  "traffic_detail": "<교통 상세>",
  "infra_detail": "<인프라 상세>",
  "school_detail": "<학군 상세>",
  "noise_detail": "<소음 상세>",
  "commerce_detail": "<상권 상세>",
  "development_detail": "<개발 잠재력 상세>",
  "alternatives": [
    {"name": "<대안 지역 1>", "score": <0-100>, "note": "<차이점>"},
    {"name": "<대안 지역 2>", "score": <0-100>, "note": "<차이점>"},
    {"name": "<대안 지역 3>", "score": <0-100>, "note": "<차이점>"}
  ],
  "noise_times": [
    {"label": "새벽 00-06시", "pct": <0-100>, "note": "<주요 원인>"},
    {"label": "오전 06-12시", "pct": <0-100>, "note": "<주요 원인>"},
    {"label": "오후 12-18시", "pct": <0-100>, "note": "<주요 원인>"},
    {"label": "저녁 18-24시", "pct": <0-100>, "note": "<주요 원인>"}
  ]
}`;

  const message = await getAnthropic().messages.create({
    model:      'claude-sonnet-4-20250514',
    max_tokens: 1500,
    messages:   [{ role: 'user', content: prompt }],
  });

  const raw   = (message.content[0] as { text: string }).text.trim();
  const clean = raw.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
  return JSON.parse(clean);
}
