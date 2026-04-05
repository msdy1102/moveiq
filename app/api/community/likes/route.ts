// app/api/community/likes/route.ts
// 좋아요 토글 (POST)
import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { apiError } from '@/lib/error-handler';
import { createServiceClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? '127.0.0.1';
  if (!rateLimit(ip, { windowMs: 60 * 1000, max: 60 })) return apiError('RATE_LIMITED', 429);

  let body: { target_id?: string; target_type?: string; session_id?: string };
  try { body = await req.json(); } catch { return apiError('INVALID_INPUT', 400); }

  const { target_id, target_type, session_id } = body;
  if (!target_id || !['post','comment'].includes(target_type ?? '') || !session_id)
    return apiError('INVALID_INPUT', 400);

  try {
    const sb = createServiceClient();

    // 이미 좋아요 했는지 확인
    const { data: existing } = await sb
      .from('community_likes')
      .select('id')
      .eq('target_id',   target_id)
      .eq('target_type', target_type!)
      .eq('session_id',  session_id)
      .single();

    const table = target_type === 'post' ? 'community_posts' : 'community_comments';
    const { data: target } = await sb.from(table).select('likes').eq('id', target_id).single();
    const currentLikes = target?.likes ?? 0;

    if (existing) {
      // 좋아요 취소
      await sb.from('community_likes').delete().eq('id', existing.id);
      await sb.from(table).update({ likes: Math.max(0, currentLikes - 1) }).eq('id', target_id);
      return NextResponse.json({ success: true, liked: false, likes: Math.max(0, currentLikes - 1) });
    } else {
      // 좋아요
      await sb.from('community_likes').insert({ target_id, target_type, session_id });
      await sb.from(table).update({ likes: currentLikes + 1 }).eq('id', target_id);
      return NextResponse.json({ success: true, liked: true, likes: currentLikes + 1 });
    }
  } catch (err) {
    return apiError('INTERNAL_ERROR', 500, err);
  }
}
