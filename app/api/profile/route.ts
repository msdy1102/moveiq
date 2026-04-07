// app/api/profile/route.ts
// 플랜 정보 조회 + 구독 만료 자동 처리
import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { apiError } from '@/lib/error-handler';
import { createServiceClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? '127.0.0.1';
  if (!rateLimit(ip, { windowMs: 60 * 1000, max: 60, key: 'profile' })) return apiError('RATE_LIMITED', 429);

  const userId = req.nextUrl.searchParams.get('user_id');
  if (!userId) return apiError('INVALID_INPUT', 400);

  try {
    const supabase = createServiceClient();
    const today    = new Date().toISOString().slice(0, 10);

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('plan, plan_expires_at, daily_count, daily_reset_at, analysis_count')
      .eq('id', userId)
      .single();

    if (error || !profile) {
      // 프로필 없으면 생성
      await supabase.from('profiles').upsert({
        id: userId, plan: 'free', daily_count: 0,
        daily_reset_at: today, analysis_count: 0,
      });
      return NextResponse.json({
        success: true,
        plan: 'free', plan_expires_at: null,
        daily_count: 0, daily_limit: 3, remaining: 3, analysis_count: 0,
      });
    }

    let plan = profile.plan as string;

    // 구독 만료 자동 다운그레이드
    if (plan === 'premium' && profile.plan_expires_at) {
      if (new Date(profile.plan_expires_at) < new Date()) {
        plan = 'free';
        await supabase
          .from('profiles')
          .update({ plan: 'free', plan_expires_at: null, updated_at: new Date().toISOString() })
          .eq('id', userId);
      }
    }

    // daily_count 리셋
    let daily_count = profile.daily_count ?? 0;
    if (profile.daily_reset_at !== today) {
      daily_count = 0;
      await supabase
        .from('profiles')
        .update({ daily_count: 0, daily_reset_at: today, updated_at: new Date().toISOString() })
        .eq('id', userId);
    }

    const LIMITS: Record<string, number> = { free: 3, one_time: 1, premium: 9999 };
    const daily_limit = LIMITS[plan] ?? 3;
    const remaining   = Math.max(0, daily_limit - daily_count);

    // one_time 플랜은 남은 구매 횟수로 계산
    const effectiveRemaining = plan === 'one_time'
      ? (profile.analysis_count ?? 0)
      : remaining;

    return NextResponse.json({
      success:          true,
      plan,
      plan_expires_at:  profile.plan_expires_at ?? null,
      daily_count,
      daily_limit,
      remaining:        effectiveRemaining,
      analysis_count:   profile.analysis_count ?? 0,
    });
  } catch (err) {
    return apiError('INTERNAL_ERROR', 500, err);
  }
}
