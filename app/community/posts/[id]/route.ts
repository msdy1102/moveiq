// app/api/community/posts/[id]/route.ts
// 게시글 상세 조회 (GET) + 삭제 (DELETE)
import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { apiError } from '@/lib/error-handler';
import { createServiceClient } from '@/lib/supabase';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? '127.0.0.1';
  if (!rateLimit(ip, { windowMs: 60 * 1000, max: 120, key: 'community-post-detail' })) return apiError('RATE_LIMITED', 429);

  const session_id = req.nextUrl.searchParams.get('session_id') ?? '';

  try {
    const sb = createServiceClient();
    const { data: post, error } = await sb
      .from('community_posts')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error || !post) return NextResponse.json({ success: false, message: '게시글을 찾을 수 없습니다.' }, { status: 404 });

    // 댓글 조회
    const { data: comments } = await sb
      .from('community_comments')
      .select('id, nickname, content, likes, is_verified, created_at, session_id')
      .eq('post_id', params.id)
      .order('created_at', { ascending: true });

    // 내 좋아요 여부
    let postLiked = false;
    let likedCommentIds: string[] = [];
    if (session_id) {
      const { data: likes } = await sb
        .from('community_likes')
        .select('target_id, target_type')
        .eq('session_id', session_id)
        .in('target_type', ['post', 'comment']);

      if (likes) {
        postLiked = likes.some(l => l.target_id === params.id && l.target_type === 'post');
        likedCommentIds = likes.filter(l => l.target_type === 'comment').map(l => l.target_id);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        ...post,
        liked: postLiked,
        is_mine: session_id ? post.session_id === session_id : false,
        comments: (comments ?? []).map(c => ({
          ...c,
          liked: likedCommentIds.includes(c.id),
          is_mine: session_id ? c.session_id === session_id : false,
        })),
      },
    });
  } catch (err) {
    return apiError('INTERNAL_ERROR', 500, err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? '127.0.0.1';
  if (!rateLimit(ip, { windowMs: 60 * 1000, max: 20, key: 'community-post-detail' })) return apiError('RATE_LIMITED', 429);

  const { session_id } = await req.json().catch(() => ({}));
  if (!session_id) return apiError('SESSION_REQUIRED', 400);

  try {
    const sb = createServiceClient();
    const { data: post } = await sb.from('community_posts').select('session_id').eq('id', params.id).single();
    if (!post) return NextResponse.json({ success: false, message: '게시글을 찾을 수 없습니다.' }, { status: 404 });
    if (post.session_id !== session_id) return NextResponse.json({ success: false, message: '삭제 권한이 없습니다.' }, { status: 403 });

    await sb.from('community_posts').delete().eq('id', params.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return apiError('INTERNAL_ERROR', 500, err);
  }
}
