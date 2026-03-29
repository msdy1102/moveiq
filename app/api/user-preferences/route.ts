// app/api/user-preferences/route.ts
// 사용자 환경설정 (검색 히스토리, 커뮤니티 관심 동네) CRUD
// session_id(익명 UUID) 기반 — 로그인 없이도 동작
import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { apiError } from '@/lib/error-handler';
import { createServiceClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? '127.0.0.1';
  if (!rateLimit(ip, { windowMs: 60 * 1000, max: 60 })) return apiError('RATE_LIMITED', 429);

  const sessionId = req.nextUrl.searchParams.get('session_id');
  if (!sessionId) return apiError('SESSION_REQUIRED', 400);

  try {
    const sb = createServiceClient();
    const { data } = await sb
      .from('user_preferences')
      .select('search_history, community_dongs')
      .eq('session_id', sessionId)
      .single();

    return NextResponse.json({
      success: true,
      search_history:   (data?.search_history   as string[]) ?? [],
      community_dongs:  (data?.community_dongs   as string[]) ?? [],
    });
  } catch {
    return NextResponse.json({ success: true, search_history: [], community_dongs: [] });
  }
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? '127.0.0.1';
  if (!rateLimit(ip, { windowMs: 60 * 1000, max: 60 })) return apiError('RATE_LIMITED', 429);

  let body: { session_id?: string; search_history?: string[]; community_dongs?: string[] };
  try { body = await req.json(); } catch { return apiError('INVALID_INPUT', 400); }

  const { session_id, search_history, community_dongs } = body;
  if (!session_id || typeof session_id !== 'string') return apiError('SESSION_REQUIRED', 400);

  // 유효성 검사
  if (search_history && (!Array.isArray(search_history) || search_history.length > 20))
    return apiError('INVALID_INPUT', 400);
  if (community_dongs && (!Array.isArray(community_dongs) || community_dongs.length > 30))
    return apiError('INVALID_INPUT', 400);

  try {
    const sb = createServiceClient();
    const update: Record<string, any> = { session_id, updated_at: new Date().toISOString() };
    if (search_history  !== undefined) update.search_history  = search_history;
    if (community_dongs !== undefined) update.community_dongs = community_dongs;

    await sb.from('user_preferences').upsert(update, { onConflict: 'session_id' });
    return NextResponse.json({ success: true });
  } catch (err) {
    return apiError('INTERNAL_ERROR', 500, err);
  }
}
