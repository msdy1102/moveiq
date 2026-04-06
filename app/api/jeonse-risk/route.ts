// app/api/jeonse-risk/route.ts
// 전세사기 위험도 분석
// Phase 1: Claude AI 기반 위험도 추론 (주소 + 공공데이터)
// Phase 2: 국토부 실거래가 API 연동 (추후 프록시 서버 구축 시)
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { rateLimit } from '@/lib/rate-limit';
import { apiError } from '@/lib/error-handler';
import { createServiceClient } from '@/lib/supabase';

function getAnthropic() {
  const key = process.env.CLAUDE_API_KEY;
  if (!key) throw new Error('CLAUDE_API_KEY 미설정');
  return new Anthropic({ apiKey: key });
}

// 국토부 실거래가 API 조회 시도 (Vercel에서 실패 시 null 반환)
async function fetchRealTradeData(address: string): Promise<{
  avg_price: number | null;
  jeonse_rate: number | null;
  recent_trades: { date: string; price: number; type: string }[];
} | null> {
  const key = process.env.PUBLIC_DATA_API_KEY;
  if (!key) return null;

  // 주소에서 법정동코드 추출 시도
  // data.go.kr 아파트 전세 실거래가 API
  try {
    const res = await fetch(
      `https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade` +
      `?serviceKey=${key}&pageNo=1&numOfRows=10&_type=json`,
      { signal: AbortSignal.timeout(3000) }
    );
    if (!res.ok) return null;
    return null; // Vercel IP 차단으로 실제 데이터 없음 → null 반환 → AI fallback
  } catch {
    return null;
  }
}

// Claude AI 기반 전세 위험도 분석
async function analyzeJeonseRisk(
  address: string,
  analysisResult: any,
  tradeData: any
) {
  const commerceScore   = analysisResult?.scores?.commerce    ?? 50;
  const developScore    = analysisResult?.scores?.development ?? 50;
  const commerceDetail  = analysisResult?.commerce_detail     ?? '';
  const developDetail   = analysisResult?.development_detail  ?? '';
  const aiComment       = analysisResult?.ai_comment          ?? '';

  const prompt = `당신은 대한민국 전세사기 예방 전문가입니다.
주어진 입지 분석 데이터를 바탕으로 전세사기 위험도를 평가해주세요.

주소: ${address}
상권 활성도 점수: ${commerceScore}/100 (높을수록 상권 활성)
개발 잠재력 점수: ${developScore}/100 (높을수록 개발 가능성)
상권 상세: ${commerceDetail}
개발 상세: ${developDetail}
AI 종합 의견: ${aiComment}
${tradeData ? `실거래가 데이터: ${JSON.stringify(tradeData)}` : '실거래가 데이터: 없음 (AI 추론 기반)'}

전세사기 위험도를 평가하고 아래 JSON 형식으로 응답하세요. JSON 외 다른 텍스트 절대 금지.

{
  "risk_level": "<low|medium|high>",
  "risk_score": <0-100, 높을수록 위험>,
  "jeonse_rate_estimate": "<예: 75-85% 추정>",
  "summary": "<위험도 요약 2문장>",
  "risk_factors": [
    "<위험 요소 1>",
    "<위험 요소 2>",
    "<위험 요소 3>"
  ],
  "safe_factors": [
    "<안전 요소 1>",
    "<안전 요소 2>"
  ],
  "checklist": [
    "<계약 전 필수 확인 항목 1>",
    "<계약 전 필수 확인 항목 2>",
    "<계약 전 필수 확인 항목 3>",
    "<계약 전 필수 확인 항목 4>",
    "<계약 전 필수 확인 항목 5>",
    "<계약 전 필수 확인 항목 6>"
  ],
  "recommendations": "<이 지역 전세 계약 시 특별히 주의할 점 2~3문장>"
}`;

  const message = await getAnthropic().messages.create({
    model:      'claude-sonnet-4-20250514',
    max_tokens: 1000,
    messages:   [{ role: 'user', content: prompt }],
  });

  const raw   = (message.content[0] as { text: string }).text.trim();
  const clean = raw.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
  return JSON.parse(clean);
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? '127.0.0.1';
  if (!rateLimit(ip, { windowMs: 10 * 60 * 1000, max: 5 })) {
    return apiError('RATE_LIMITED', 429);
  }

  let body: { address?: string; analysis_result?: any };
  try { body = await req.json(); } catch { return apiError('INVALID_INPUT', 400); }

  const { address, analysis_result } = body;
  if (!address?.trim()) return apiError('ADDRESS_REQUIRED', 400);

  try {
    const sb = createServiceClient();

    // 캐시 확인 (12시간)
    const { data: cached } = await sb
      .from('analysis_cache')
      .select('result')
      .eq('address', `jeonse:${address}`)
      .gte('created_at', new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString())
      .single();

    if (cached?.result) {
      return NextResponse.json({ success: true, data: cached.result, cached: true });
    }

    // 실거래가 데이터 조회 시도
    const tradeData = await fetchRealTradeData(address);

    // AI 분석
    const result = await analyzeJeonseRisk(address, analysis_result, tradeData);

    // 캐시 저장
    try {
      await sb.from('analysis_cache').upsert({
        address:    `jeonse:${address}`,
        result,
        created_at: new Date().toISOString(),
      });
    } catch {}

    return NextResponse.json({ success: true, data: result, cached: false });
  } catch (err) {
    return apiError('ANALYSIS_FAILED', 500, err);
  }
}
