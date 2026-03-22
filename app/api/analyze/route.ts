// app/api/analyze/route.ts
// ────────────────────────────────────────────────────────────
// Claude API는 여기서만 호출됩니다. 브라우저에서 직접 호출 불가.
// Rate Limit: IP당 10분에 5회
// ────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { rateLimit } from '@/lib/rate-limit';
import { apiError } from '@/lib/error-handler';
import { createServiceClient } from '@/lib/supabase';

const anthropic = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

// 플랜별 금액 기준표 — 서버에서만 관리 (프론트 전달 금액 신뢰 금지)
const PLAN_PRICES = {
  move_plan_single: 4900,
  monthly_basic:   14900,
  monthly_premium: 29900,
} as const;

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

    // 4. Kakao Local API로 시설 정보 수집
    const kakaoData = await fetchKakaoFacilities(address);

    // 5. Claude Sonnet으로 종합 분석
    const analysisResult = await runClaudeAnalysis(address, kakaoData);

    // 6. 캐시 저장
    await supabase
      .from('analysis_cache')
      .upsert({ address, result: analysisResult, created_at: new Date().toISOString() });

    return NextResponse.json({ success: true, data: analysisResult, cached: false });
  } catch (err) {
    return apiError('ANALYSIS_FAILED', 500, err);
  }
}

// ── Kakao Local API 시설 수집 ──────────────────────────────
async function fetchKakaoFacilities(address: string) {
  const kakaoKey = process.env.KAKAO_LOCAL_API_KEY;
  if (!kakaoKey) return null;

  const categories = [
    { code: 'SW8',  label: '지하철역' },
    { code: 'HP8',  label: '병원' },
    { code: 'PM9',  label: '약국' },
    { code: 'MT1',  label: '대형마트' },
    { code: 'CS2',  label: '편의점' },
    { code: 'SC4',  label: '학교' },
    { code: 'CE7',  label: '카페' },
    { code: 'PK6',  label: '주차장' },
  ];

  const results: Record<string, number> = {};

  for (const cat of categories) {
    try {
      // 키워드 검색으로 주소 기반 시설 수집
      const res = await fetch(
        `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(address + ' ' + cat.label)}&size=15`,
        { headers: { Authorization: `KakaoAK ${kakaoKey}` } }
      );
      const data = await res.json();
      results[cat.label] = data.documents?.length ?? 0;
    } catch {
      results[cat.label] = 0;
    }
  }

  return results;
}

// ── Claude Sonnet 입지 분석 ────────────────────────────────
async function runClaudeAnalysis(address: string, facilities: Record<string, number> | null) {
  const facilityStr = facilities
    ? Object.entries(facilities).map(([k, v]) => `${k}: ${v}개`).join(', ')
    : '시설 데이터 없음';

  const prompt = `당신은 한국 부동산 입지 분석 전문가입니다.
다음 주소에 대해 이사 결정자 관점에서 입지를 분석해 주세요.

주소: ${address}
반경 1km 시설 현황: ${facilityStr}

아래 JSON 형식으로 정확히 응답하세요. JSON 외 다른 텍스트는 절대 포함하지 마세요.

{
  "address": "${address}",
  "scores": {
    "traffic": <교통접근성 0-100>,
    "infra": <생활인프라 0-100>,
    "school": <학군환경 0-100>,
    "noise": <소음환경 0-100, 유흥가 밀집 시 낮게>,
    "commerce": <상권활성도 0-100>,
    "development": <개발잠재력 0-100>
  },
  "total": <종합점수 0-100>,
  "grade": "<등급: S/A+/A/A-/B+/B/B-/C+/C/D>",
  "ai_comment": "<교통·인프라 등 핵심 강약점 2~3문장, 구체적으로>",
  "traffic_detail": "<교통 접근성 상세 설명 1~2문장>",
  "infra_detail": "<생활 인프라 상세 설명 1~2문장>",
  "school_detail": "<학군 환경 상세 설명 1~2문장>",
  "noise_detail": "<소음 환경 및 주의사항 1~2문장>",
  "commerce_detail": "<상권 활성도 상세 설명 1~2문장>",
  "development_detail": "<개발 잠재력 상세 설명 1~2문장>",
  "alternatives": [
    {"name": "<인근 대안 지역 1>", "score": <0-100>, "note": "<차이점>"},
    {"name": "<인근 대안 지역 2>", "score": <0-100>, "note": "<차이점>"},
    {"name": "<인근 대안 지역 3>", "score": <0-100>, "note": "<차이점>"}
  ],
  "noise_times": [
    {"label": "새벽 00-06시", "pct": <0-100>, "note": "<주요 원인>"},
    {"label": "오전 06-12시", "pct": <0-100>, "note": "<주요 원인>"},
    {"label": "오후 12-18시", "pct": <0-100>, "note": "<주요 원인>"},
    {"label": "저녁 18-24시", "pct": <0-100>, "note": "<주요 원인>"}
  ]
}`;

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = (message.content[0] as { text: string }).text.trim();

  // JSON 파싱 — 백틱 fence 제거
  const clean = raw.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
  return JSON.parse(clean);
}
