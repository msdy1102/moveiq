// app/api/community/comments/route.ts
// 댓글 작성 (POST) + 삭제 (DELETE)
import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { apiError } from '@/lib/error-handler';
import { createServiceClient } from '@/lib/supabase';

// 댓글 작성
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? '127.0.0.1';
  if (!rateLimit(ip, { windowMs: 5 * 60 * 1000, max: 10 })) return apiError('RATE_LIMITED', 429);

  let body: { post_id?: string; session_id?: string; user_id?: string; nickname?: string; content?: string };
  try { body = await req.json(); } catch { return apiError('INVALID_INPUT', 400); }

  const { post_id, session_id, user_id, nickname, content } = body;

  if (!post_id)     return NextResponse.json({ success: false, message: '게시글 ID가 필요합니다.' }, { status: 400 });
  if (!session_id)  return apiError('SESSION_REQUIRED', 400);
  if (!content?.trim() || content.trim().length < 1 || content.trim().length > 1000)
    return NextResponse.json({ success: false, message: '댓글은 1~1000자 사이로 입력해주세요.' }, { status: 400 });

  try {
    const sb = createServiceClient();

    // 게시글 존재 확인
    const { data: post } = await sb.from('community_posts').select('id').eq('id', post_id).single();
    if (!post) return NextResponse.json({ success: false, message: '게시글을 찾을 수 없습니다.' }, { status: 404 });

    // 댓글 저장
    const { data: comment, error } = await sb
      .from('community_comments')
      .insert({
        post_id,
        session_id,
        user_id:  user_id ?? null,
        nickname: nickname?.trim() || '익명',
        content:  content.trim(),
        ip,
      })
      .select('id, nickname, content, likes, is_verified, created_at')
      .single();

    if (error) return apiError('INTERNAL_ERROR', 500, error);

    // 게시글 댓글 수 +1
    try {
      const { data: cur } = await sb.from('community_posts').select('comments').eq('id', post_id).single();
      await sb.from('community_posts').update({ comments: (cur?.comments ?? 0) + 1 }).eq('id', post_id);
    } catch (e) { console.error('[comment] 댓글 수 업데이트 오류:', e); }

    return NextResponse.json({ success: true, data: { ...comment, liked: false, is_mine: true } }, { status: 201 });
  } catch (err) {
    return apiError('INTERNAL_ERROR', 500, err);
  }
}

// 댓글 삭제
export async function DELETE(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? '127.0.0.1';
  if (!rateLimit(ip, { windowMs: 60 * 1000, max: 20 })) return apiError('RATE_LIMITED', 429);

  const { comment_id, session_id } = await req.json().catch(() => ({}));
  if (!comment_id || !session_id) return apiError('INVALID_INPUT', 400);

  try {
    const sb = createServiceClient();
    const { data: comment } = await sb.from('community_comments').select('session_id, post_id').eq('id', comment_id).single();
    if (!comment) return NextResponse.json({ success: false, message: '댓글을 찾을 수 없습니다.' }, { status: 404 });
    if (comment.session_id !== session_id) return NextResponse.json({ success: false, message: '삭제 권한이 없습니다.' }, { status: 403 });

    await sb.from('community_comments').delete().eq('id', comment_id);

    // 댓글 수 -1
    const { data: cur } = await sb.from('community_posts').select('comments').eq('id', comment.post_id).single();
    await sb.from('community_posts').update({ comments: Math.max(0, (cur?.comments ?? 1) - 1) }).eq('id', comment.post_id);

    return NextResponse.json({ success: true });
  } catch (err) {
    return apiError('INTERNAL_ERROR', 500, err);
  }
}
