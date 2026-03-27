// app/api/analyze/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { rateLimit } from '@/lib/rate-limit';
import { apiError } from '@/lib/error-handler';
import { createServiceClient } from '@/lib/supabase';
import { fetchPublicData } from '@/lib/public-data';

// 빌드 시점 즉시 실행 방지 — 런타임에 lazy 생성
function getAnthropic() {
  const key = process.env.CLAUDE_API_KEY;
  if (!key) throw new Error('CLAUDE_API_KEY 환경변수가 설정되지 않았습니다.');
  return new Anthropic({ apiKey: key });
}

export async function POST(req: NextRequest) {
  // 1. Rate Limit 확인
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? '127.0.0.1';
  if (!rateLimit(ip, { windowMs: 10 * 60 * 1000, max: 5 })) {
    return apiError('RATE_LIMITED', 429);
  }

  // 2. 입력값 검증
  let body: { address?: string };
  try {
    body = await req.json();
  } catch {
    return apiError('INVALID_INPUT', 400);
  }

  const address = body.address?.trim();
  if (!address || address.length < 2 || address.length > 100) {
    return apiError('ADDRESS_REQUIRED', 400);
  }

  // 3. 캐시 확인 (Supabase analysis_cache 테이블, 24시간)
  try {
    const supabase = createServiceClient();
    const { data: cached } = await supabase
      .from('analysis_cache')
      .select('result, created_at')
      .eq('address', address)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .single();

    if (cached?.result) {
      return NextResponse.json({ success: true, data: cached.result, cached: true });
    }

    // 4. Naver Local API로 시설 정보 수집
    const naverData = await fetchNaverFacilities(address);

    // 5. 소음 제보 DB에서 반경 1km 실제 데이터 집계
    const noiseData = naverData
      ? await fetchNoiseReports(supabase, naverData._lat, naverData._lng)
      : null;

    // 6. 공공데이터 3종 병렬 수집 (브이월드 + 건설CALS + data.go.kr)
    const publicData = naverData
      ? await fetchPublicData(naverData._lat, naverData._lng, address)
      : null;

    // 7. Claude Sonnet으로 종합 분석 (시설 + 소음 + 공공데이터 함께 전달)
    const analysisResult = await runClaudeAnalysis(address, naverData, noiseData, publicData);

    // 8. 캐시 저장
    await supabase
      .from('analysis_cache')
      .upsert({ address, result: analysisResult, created_at: new Date().toISOString() });

    return NextResponse.json({ success: true, data: analysisResult, cached: false });
  } catch (err) {
    return apiError('ANALYSIS_FAILED', 500, err);
  }
}

// ── Naver Local API 시설 수집 ──────────────────────────────
async function fetchNaverFacilities(address: string): Promise<(Record<string, number> & { _lat: number; _lng: number }) | null> {
  const clientId     = process.env.NAVER_MAP_CLIENT_ID;
  const clientSecret = process.env.NAVER_MAP_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const headers = {
    'X-NCP-APIGW-API-KEY-ID': clientId,
    'X-NCP-APIGW-API-KEY':    clientSecret,
  };

  // Step 1: 주소 → 좌표
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
  } catch {
    return null;
  }

  // Step 2: 키워드별 주변 시설 검색
  const keywords = [
    { keyword: '지하철역',  label: '지하철역' },
    { keyword: '병원',      label: '병원'     },
    { keyword: '약국',      label: '약국'     },
    { keyword: '대형마트',  label: '대형마트' },
    { keyword: '편의점',    label: '편의점'   },
    { keyword: '초등학교',  label: '학교'     },
    { keyword: '카페',      label: '카페'     },
    { keyword: '공원',      label: '공원'     },
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
    } catch {
      results[label] = 0;
    }
  }));

  return results;
}

// ── Supabase 소음 제보 집계 (반경 1km) ──────────────────────
interface NoiseStats {
  total: number;
  by_type: Record<string, number>;
  by_time: Record<string, number>;
  avg_severity: number;
  recent_30d: number;
}

async function fetchNoiseReports(supabase: any, lat: number, lng: number): Promise<NoiseStats | null> {
  try {
    // 위도/경도 1km ≈ 0.009도 범위로 근사 필터 후 DB에서 조회
    const delta = 0.009;
    const { data, error } = await supabase
      .from('noise_reports')
      .select('noise_type, time_slot, severity, created_at, lat, lng')
      .gte('lat', lat - delta)
      .lte('lat', lat + delta)
      .gte('lng', lng - delta)
      .lte('lng', lng + delta)
      .gte('created_at', new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString()) // 최근 6개월
      .limit(500);

    if (error || !data?.length) return null;

    // 실제 거리 필터 (1km 이내만)
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

    return {
      total:        nearby.length,
      by_type,
      by_time,
      avg_severity: Math.round((severity_sum / nearby.length) * 10) / 10,
      recent_30d,
    };
  } catch {
    return null;
  }
}

// ── Claude Sonnet 입지 분석 ────────────────────────────────
async function runClaudeAnalysis(
  address: string,
  facilities: (Record<string, number> & { _lat?: number; _lng?: number }) | null,
  noiseStats: NoiseStats | null,
  publicData: import('@/lib/public-data').PublicDataResult | null,
) {
  // 시설 데이터 — _lat/_lng 내부 키 제외
  const facilityStr = facilities
    ? Object.entries(facilities)
        .filter(([k]) => !k.startsWith('_'))
        .map(([k, v]) => `${k}: ${v}개`)
        .join(', ')
    : '시설 데이터 없음';

  // 소음 데이터 문자열 생성
  const TYPE_KO: Record<string, string> = {
    construction: '공사', entertainment: '유흥', floor: '층간', traffic: '교통', other: '기타',
  };
  const TIME_KO: Record<string, string> = {
    dawn: '새벽', morning: '오전', afternoon: '오후', evening: '저녁', night: '심야',
  };

  const noiseStr = noiseStats
    ? [
        `총 제보 ${noiseStats.total}건 (최근 30일 ${noiseStats.recent_30d}건)`,
        `평균 심각도 ${noiseStats.avg_severity}/5`,
        `유형별: ${Object.entries(noiseStats.by_type).map(([k,v])=>`${TYPE_KO[k]??k} ${v}건`).join(', ')}`,
        `시간대별: ${Object.entries(noiseStats.by_time).map(([k,v])=>`${TIME_KO[k]??k} ${v}건`).join(', ')}`,
      ].join(' / ')
    : '제보 데이터 없음 (조용한 지역이거나 데이터 미수집)';

  // 공공데이터 문자열
  const publicStr = publicData?.summary ?? '공공데이터 없음';

  const prompt = `당신은 한국 부동산 입지 분석 전문가입니다.
다음 주소에 대해 이사 결정자 관점에서 입지를 분석해 주세요.

주소: ${address}
반경 1km 시설 현황: ${facilityStr}
반경 1km 실제 소음 제보 현황: ${noiseStr}
공공데이터 (개발계획·건축·교통·실거래): ${publicStr}

분석 지침:
- 소음·환경 점수는 실제 소음 제보 현황 데이터를 우선 반영하세요
- 개발 잠재력 점수는 공공데이터의 잠재력 등급·건축인허가·개발행위허가·재개발 여부를 반영하세요
- 개발제한구역(그린벨트)이면 개발 잠재력 점수를 낮게 부여하세요
- 교통 점수에 평균 통행시간을 반영하세요
- 실거래가가 있으면 상권 활성도 판단에 참고하세요

아래 JSON 형식으로 정확히 응답하세요. JSON 외 다른 텍스트는 절대 포함하지 마세요.

{
  "address": "${address}",
  "scores": {
    "traffic": <교통접근성 0-100, 평균통행시간 반영>,
    "infra": <생활인프라 0-100>,
    "school": <학군환경 0-100>,
    "noise": <소음환경 0-100 — 실제 제보 데이터 기반>,
    "commerce": <상권활성도 0-100, 실거래가 반영>,
    "development": <개발잠재력 0-100 — 공공데이터 기반, 그린벨트면 낮게>
  },
  "total": <종합점수 0-100>,
  "grade": "<등급: S/A+/A/A-/B+/B/B-/C+/C/D>",
  "ai_comment": "<교통·인프라 등 핵심 강약점 2~3문장, 공공데이터·소음 데이터 언급 포함>",
  "traffic_detail": "<교통 접근성 상세 — 평균 통행시간 포함 1~2문장>",
  "infra_detail": "<생활 인프라 상세 1~2문장>",
  "school_detail": "<학군 환경 상세 1~2문장>",
  "noise_detail": "<실제 소음 제보 기반 상세 — 시간대·유형·심각도 포함 1~2문장>",
  "commerce_detail": "<상권 활성도 상세 — 실거래가 언급 1~2문장>",
  "development_detail": "<개발 잠재력 상세 — 인허가 건수·그린벨트 여부·용도지역 포함 1~2문장>",
  "alternatives": [
    {"name": "<인근 대안 지역 1>", "score": <0-100>, "note": "<차이점>"},
    {"name": "<인근 대안 지역 2>", "score": <0-100>, "note": "<차이점>"},
    {"name": "<인근 대안 지역 3>", "score": <0-100>, "note": "<차이점>"}
  ],
  "noise_times": [
    {"label": "새벽 00-06시", "pct": <실제 새벽 제보 비율 0-100>, "note": "<주요 원인>"},
    {"label": "오전 06-12시", "pct": <실제 오전 제보 비율 0-100>, "note": "<주요 원인>"},
    {"label": "오후 12-18시", "pct": <실제 오후 제보 비율 0-100>, "note": "<주요 원인>"},
    {"label": "저녁 18-24시", "pct": <실제 저녁 제보 비율 0-100>, "note": "<주요 원인>"}
  ]
}`;

  const message = await getAnthropic().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw   = (message.content[0] as { text: string }).text.trim();
  const clean = raw.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
  return JSON.parse(clean);
}
