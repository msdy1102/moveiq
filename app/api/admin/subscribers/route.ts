// app/api/admin/subscribers/route.ts
// 구독자 관리 — 목록 조회 + 플랜 수동 변경
// GET  — 구독자 목록 (plan 필터, 검색)
// POST — 플랜 수동 변경

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, logAdminAction } from '@/lib/admin-auth';
import { apiError }                    from '@/lib/error-handler';
import { createServiceClient }         from '@/lib/supabase';

const VALID_PLANS = ['free', 'one_time', 'premium'] as const;
const UUID_RE     = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── GET: 구독자 목록 ─────────────────────────────────────────
export async function GET(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (admin instanceof Response) return admin;

  const plan   = req.nextUrl.searchParams.get('plan')   ?? 'all';
  const search = req.nextUrl.searchParams.get('search') ?? '';
  const limit  = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? 50), 200);

  try {
    const sb = createServiceClient();

    let query = sb
      .from('profiles')
      .select('id, nickname, plan, plan_expires_at, analysis_count, daily_count, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (plan !== 'all') query = query.eq('plan', plan);
    if (search) query = query.ilike('nickname', `%${search}%`);

    const { data, error } = await query;
    if (error) return apiError('INTERNAL_ERROR', 500, error);

    // 만료 여부 계산
    const now = new Date();
    const enriched = (data ?? []).map(p => ({
      ...p,
      is_expired: p.plan === 'premium' && p.plan_expires_at
        ? new Date(p.plan_expires_at) < now
        : false,
    }));

    return NextResponse.json({ success: true, data: enriched });
  } catch (err) {
    return apiError('INTERNAL_ERROR', 500, err);
  }
}

// ── POST: 플랜 수동 변경 ─────────────────────────────────────
export async function POST(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (admin instanceof Response) return admin;

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? '127.0.0.1';

  let body: { user_id?: string; plan?: string; expires_days?: number; note?: string };
  try { body = await req.json(); } catch { return apiError('INVALID_INPUT', 400); }

  const { user_id, plan, expires_days, note } = body;
  if (!user_id || !UUID_RE.test(user_id))             return apiError('INVALID_INPUT', 400);
  if (!plan || !VALID_PLANS.includes(plan as any))     return apiError('INVALID_INPUT', 400);

  try {
    const sb = createServiceClient();

    // 기존 플랜 조회
    const { data: prev } = await sb
      .from('profiles')
      .select('plan, nickname')
      .eq('id', user_id)
      .single();

    // 만료일 계산
    let expiresAt: string | null = null;
    if (plan === 'premium' && expires_days) {
      const d = new Date();
      d.setDate(d.getDate() + expires_days);
      expiresAt = d.toISOString();
    }

    const { error } = await sb.from('profiles').update({
      plan,
      plan_expires_at: expiresAt,
      updated_at:      new Date().toISOString(),
    }).eq('id', user_id);

    if (error) return apiError('INTERNAL_ERROR', 500, error);

    // 감사 로그
    await logAdminAction({
      adminId:  admin.id,
      action:   'plan_change',
      targetId: user_id,
      detail:   { from: prev?.plan, to: plan, expires_days, note, nickname: prev?.nickname },
      ip,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return apiError('INTERNAL_ERROR', 500, err);
  }
}
