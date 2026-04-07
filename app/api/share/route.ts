// app/api/share/route.ts
// ────────────────────────────────────────────────────────────
// 분석 결과 공유 링크 생성 (POST) / 조회 (GET)
// - POST: result JSON → share_token 생성 → DB 저장 → 고유 URL 반환
// - GET:  token으로 저장된 result 조회
// - 만료: 30일
// ────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { apiError } from '@/lib/error-handler';
import { createServiceClient } from '@/lib/supabase';

const SHARE_TTL_DAYS = 30;

// ── POST: 공유 링크 생성 ──────────────────────────────────
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? '127.0.0.1';
  // 공유 생성: IP당 분당 10회 제한
  if (!rateLimit(ip, { windowMs: 60 * 1000, max: 10, key: 'share' })) {
    return apiError('RATE_LIMITED', 429);
  }

  let body: { address?: string; result?: Record<string, unknown> };
  try { body = await req.json(); }
  catch { return apiError('INVALID_INPUT', 400); }

  if (!body.address || !body.result) return apiError('INVALID_INPUT', 400);
  if (typeof body.address !== 'string' || body.address.length > 200) return apiError('INVALID_INPUT', 400);

  // result 크기 제한 (50KB) — 대용량 페이로드 저장 방지
  const resultStr = JSON.stringify(body.result);
  if (resultStr.length > 50_000) return apiError('INVALID_INPUT', 400);

  // 허용 필드만 저장 (알 수 없는 필드 제거)
  const ALLOWED_KEYS = ['address','scores','total','grade','ai_comment',
    'traffic_detail','infra_detail','school_detail','noise_detail',
    'commerce_detail','development_detail','alternatives','noise_times'];
  const sanitizedResult = Object.fromEntries(
    Object.entries(body.result).filter(([k]) => ALLOWED_KEYS.includes(k))
  );

  // 토큰 생성 (crypto.randomUUID)
  const token     = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  const expiresAt = new Date(Date.now() + SHARE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from('shared_reports').insert({
      token,
      address:    body.address,
      result:     sanitizedResult,
      expires_at: expiresAt,
      created_ip: ip,
    });

    if (error) return apiError('SHARE_CREATE_FAILED', 500, error);

    return NextResponse.json({
      success:   true,
      token,
      share_url: `https://moveiq.vercel.app/analysis/share/${token}`,
      expires_at: expiresAt,
    });
  } catch (err) {
    return apiError('INTERNAL_ERROR', 500, err);
  }
}

// ── GET: 공유 링크 조회 ───────────────────────────────────
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token || !/^[a-f0-9]{16}$/.test(token)) return apiError('INVALID_TOKEN', 400);

  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('shared_reports')
      .select('address, result, expires_at, created_at')
      .eq('token', token)
      .single();

    if (error || !data) return apiError('NOT_FOUND', 404);

    // 만료 체크
    if (new Date(data.expires_at) < new Date()) {
      return apiError('EXPIRED', 410);
    }

    // 조회수 증가 (fire-and-forget)
    supabase.from('shared_reports')
      .update({ view_count: supabase.rpc('increment' as any) })
      .eq('token', token)
      .then(() => {});

    return NextResponse.json({
      success:    true,
      address:    data.address,
      result:     data.result,
      created_at: data.created_at,
      expires_at: data.expires_at,
    });
  } catch (err) {
    return apiError('INTERNAL_ERROR', 500, err);
  }
}
