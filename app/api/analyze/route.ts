// app/api/analyze/route.ts — v5
// 구독 상태 기반 기능 잠금 구현
// - Free: 월 3회 / 일 3회 (daily_count)
// - one_time: 1회 (analysis_count 차감)
// - premium: 무제한
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { rateLimit } from '@/lib/rate-limit';
import { apiError } from '@/lib/error-handler';
import { createServiceClient } from '@/lib/supabase';
import { fetchPublicData } from '@/lib/public-data';

// ── 플랜별 제한 설정 ────────────────────────────────────────
const PLAN_LIMITS: Record<string, { daily: number; total: number | null }> = {
  free:     { daily: 3,    total: null },   // 일 3회 (월별 리셋)
  one_time: { daily: 1,    total: 1    },   // 구매 당 1회
  premium:  { daily: 9999, total: null },   // 무제한
};

// ── 플랜 정보 조회 + 횟수 체크 ─────────────────────────────
async function checkAndConsumeQuota(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
): Promise<{
  allowed: boolean;
  plan: string;
  daily_count: number;
  daily_limit: number;
  remaining: number;
  message?: string;
}> {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // profiles 조회
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('plan, plan_expires_at, daily_count, daily_reset_at, analysis_count')
    .eq('id', userId)
    .single();

  if (error || !profile) {
    // 프로필 없으면 기본값으로 생성
    await supabase.from('profiles').upsert({
      id:            userId,
      plan:          'free',
      daily_count:   0,
      daily_reset_at: today,
      analysis_count: 0,
    });
    return { allowed: true, plan: 'free', daily_count: 0, daily_limit: 3, remaining: 3 };
  }

  // ── 구독 만료 자동 다운그레이드 ────────────────────────────
  let plan = profile.plan as string;
  if (plan === 'premium' && profile.plan_expires_at) {
    const expiresAt = new Date(profile.plan_expires_at);
    if (expiresAt < new Date()) {
      plan = 'free';
      await supabase
        .from('profiles')
        .update({ plan: 'free', plan_expires_at: null, updated_at: new Date().toISOString() })
        .eq('id', userId);
    }
  }

  const limits     = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
  const daily_limit = limits.daily;

  // ── daily_count 리셋 (날짜가 바뀌었으면) ──────────────────
  let daily_count = profile.daily_count ?? 0;
  if (profile.daily_reset_at !== today) {
    daily_count = 0;
    await supabase
      .from('profiles')
      .update({ daily_count: 0, daily_reset_at: today, updated_at: new Date().toISOString() })
      .eq('id', userId);
  }

  // ── 횟수 체크 ──────────────────────────────────────────────
  const remaining = Math.max(0, daily_limit - daily_count);

  // one_time 플랜: 구매 후 남은 횟수 확인
  if (plan === 'one_time') {
    const oneTimeRemaining = profile.analysis_count ?? 0;
    if (oneTimeRemaining <= 0) {
      return {
        allowed: false, plan, daily_count, daily_limit,
        remaining: 0,
        message: '이사 한 번 플랜 사용 횟수를 모두 사용했습니다. 다시 구매해주세요.',
      };
    }
  }

  if (plan === 'free' && daily_count >= daily_limit) {
    return {
      allowed: false, plan, daily_count, daily_limit,
      remaining: 0,
      message: `오늘 무료 분석 ${daily_limit}회를 모두 사용했습니다. 내일 다시 시도하거나 유료 플랜으로 업그레이드해주세요.`,
    };
  }

  // ── 카운트 증가 ────────────────────────────────────────────
  const updateData: Record<string, any> = {
    daily_count:   daily_count + 1,
    analysis_count: (profile.analysis_count ?? 0) + 1,
    updated_at:    new Date().toISOString(),
  };

  // one_time 플랜은 잔여 횟수 차감
  if (plan === 'one_time') {
    updateData.analysis_count = Math.max(0, (profile.analysis_count ?? 1) - 1);
  }

  await supabase.from('profiles').update(updateData).eq('id', userId);

  return {
    allowed:     true,
    plan,
    daily_count: daily_count + 1,
    daily_limit,
    remaining:   Math.max(0, daily_limit - daily_count - 1),
  };
}

function getAnthropic() {
  const key = process.env.CLAUDE_API_KEY;
  if (!key) throw new Error('CLAUDE_API_KEY 환경변수가 설정되지 않았습니다.');
  return new Anthropic({ apiKey: key });
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? '127.0.0.1';
  if (!rateLimit(ip, { windowMs: 10 * 60 * 1000, max: 10 })) {
    return apiError('RATE_LIMITED', 429);
  }

  let body: { address?: string; session_id?: string; user_id?: string };
  try { body = await req.json(); } catch { return apiError('INVALID_INPUT', 400); }

  const address    = body.address?.trim();
  const session_id = body.session_id?.trim() ?? null;
  const user_id    = body.user_id?.trim()    ?? null;   // 클라이언트에서 Supabase auth UID 전달

  if (!address || address.length < 2 || address.length > 100) {
    return apiError('ADDRESS_REQUIRED', 400);
  }

  try {
    const supabase = createServiceClient();

    // ── 1. 구독 기반 횟수 체크 (로그인 유저만) ─────────────
    let quotaInfo: {
      plan: string;
      daily_count: number;
      daily_limit: number;
      remaining: number;
    } = { plan: 'guest', daily_count: 0, daily_limit: 3, remaining: 3 };

    if (user_id) {
      const quota = await checkAndConsumeQuota(supabase, user_id);
      if (!quota.allowed) {
        return NextResponse.json({
          success:   false,
          code:      'QUOTA_EXCEEDED',
          message:   quota.message,
          plan:      quota.plan,
          remaining: 0,
          daily_limit: quota.daily_limit,
        }, { status: 429 });
      }
      quotaInfo = quota;
    }
    // 비로그인 유저: IP Rate Limit만 적용 (이미 위에서 처리)

    // ── 2. 캐시 확인 (24시간) ───────────────────────────────
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
      const naverData  = await fetchNaverFacilities(address);
      const noiseData  = naverData ? await fetchNoiseReports(supabase, naverData._lat, naverData._lng) : null;
      const publicData = naverData ? await fetchPublicData(naverData._lat, naverData._lng, address) : null;
      result = await runClaudeAnalysis(address, naverData, noiseData, publicData);

      try {
        await supabase.from('analysis_cache').upsert({ address, result, created_at: new Date().toISOString() });
      } catch (e) { console.error('[analyze] 캐시 저장 오류:', e); }
    }

    // ── 3. 히스토리 저장 ────────────────────────────────────
    if (session_id) {
      try {
        await supabase.from('analysis_history').insert({
          session_id,
          user_id:     user_id ?? null,
          address,
          result,
          total_score: result?.total ?? null,
          grade:       result?.grade ?? null,
          cached:      isCached,
        });
      } catch (e) { console.error('[analyze] 히스토리 저장 오류:', e); }
    }

    return NextResponse.json({
      success:   true,
      data:      result,
      cached:    isCached,
      // 클라이언트에 남은 횟수 반환
      quota: {
        plan:      quotaInfo.plan,
        remaining: quotaInfo.remaining,
        daily_limit: quotaInfo.daily_limit,
      },
    });
  } catch (err) {
    return apiError('ANALYSIS_FAILED', 500, err);
  }
}

// ── 히스토리 조회 ─────────────────────────────────────────────
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

// ═══════════════════════════════════════════════════════════════
// 헬퍼 함수 (기존과 동일)
// ═══════════════════════════════════════════════════════════════

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
  total: number; by_type: Record<string, number>;
  by_time: Record<string, number>; avg_severity: number; recent_30d: number;
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
    : '제보 데이터 없음';
  const publicStr       = publicData?.summary ?? '공공데이터 없음';
  const constructionStr = publicData && publicData.active_constructions > 0
    ? `현재 진행중 공사 ${publicData.active_constructions}건` + (publicData.construction_details.length ? `: ${publicData.construction_details.join(', ')}` : '')
    : '현재 진행중 공사 없음';

  const prompt = `당신은 한국 부동산 입지 분석 전문가입니다.
주소: ${address}
반경 1km 시설: ${facilityStr}
소음 제보: ${noiseStr}
공사 현황: ${constructionStr}
공공데이터: ${publicStr}

아래 JSON만 응답하세요. 다른 텍스트 절대 금지.
{"address":"${address}","scores":{"traffic":<0-100>,"infra":<0-100>,"school":<0-100>,"noise":<0-100>,"commerce":<0-100>,"development":<0-100>},"total":<0-100>,"grade":"<S/A+/A/A-/B+/B/B-/C+/C/D>","ai_comment":"<2~3문장>","traffic_detail":"<상세>","infra_detail":"<상세>","school_detail":"<상세>","noise_detail":"<상세>","commerce_detail":"<상세>","development_detail":"<상세>","alternatives":[{"name":"<지역1>","score":<0-100>,"note":"<차이점>"},{"name":"<지역2>","score":<0-100>,"note":"<차이점>"},{"name":"<지역3>","score":<0-100>,"note":"<차이점>"}],"noise_times":[{"label":"새벽 00-06시","pct":<0-100>,"note":"<원인>"},{"label":"오전 06-12시","pct":<0-100>,"note":"<원인>"},{"label":"오후 12-18시","pct":<0-100>,"note":"<원인>"},{"label":"저녁 18-24시","pct":<0-100>,"note":"<원인>"}]}`;

  const message = await getAnthropic().messages.create({
    model: 'claude-sonnet-4-20250514', max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  });
  const raw   = (message.content[0] as { text: string }).text.trim();
  const clean = raw.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
  return JSON.parse(clean);
}
