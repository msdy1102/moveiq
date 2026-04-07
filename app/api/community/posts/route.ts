// app/api/community/posts/route.ts
// 게시글 목록 조회 (GET) + 작성 (POST)
import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { apiError } from '@/lib/error-handler';
import { createServiceClient } from '@/lib/supabase';

const VALID_CATEGORIES = ['동네 질문','생활 꿀팁','소음 후기','이사 후기','동네 소식','이웃 구해요','건물 후기'];
const SORT_OPTIONS     = ['latest','likes','verified'] as const;

// ── GET: 게시글 목록 ────────────────────────────────────────
export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? '127.0.0.1';
  if (!rateLimit(ip, { windowMs: 60 * 1000, max: 120, key: 'community-posts-get' })) return apiError('RATE_LIMITED', 429);

  const params     = req.nextUrl.searchParams;
  const dong       = params.get('dong')     ?? '전체';
  const category   = params.get('category') ?? '';
  const sort       = (params.get('sort') ?? 'latest') as typeof SORT_OPTIONS[number];
  // search: 길이 제한 (DB 부하 방지)
  const rawSearch  = params.get('search') ?? '';
  const search     = rawSearch.slice(0, 50);
  const page       = Math.max(1, parseInt(params.get('page') ?? '1'));
  const limit      = Math.min(20, parseInt(params.get('limit') ?? '20'));
  const session_id = params.get('session_id') ?? '';

  try {
    const sb = createServiceClient();
    let query = sb
      .from('community_posts')
      .select('id, user_id, session_id, nickname, dong, category, title, content, likes, comments, is_verified, created_at');

    if (dong && dong !== '전체') query = query.eq('dong', dong);
    if (category && category !== '전체') query = query.eq('category', category);
    if (search) query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`);

    if (sort === 'likes')    query = query.order('likes', { ascending: false });
    else if (sort === 'verified') query = query.order('is_verified', { ascending: false }).order('created_at', { ascending: false });
    else query = query.order('created_at', { ascending: false });

    query = query.range((page - 1) * limit, page * limit - 1);

    const { data, error } = await query;
    if (error) return apiError('INTERNAL_ERROR', 500, error);

    // 내가 좋아요 한 게시글 ID 목록
    let likedPostIds: string[] = [];
    if (session_id && data?.length) {
      const postIds = data.map(p => p.id);
      const { data: likes } = await sb
        .from('community_likes')
        .select('target_id')
        .eq('target_type', 'post')
        .eq('session_id', session_id)
        .in('target_id', postIds);
      likedPostIds = (likes ?? []).map((l: any) => l.target_id);
    }

    const posts = (data ?? []).map(p => ({
      ...p,
      content: p.content.slice(0, 150) + (p.content.length > 150 ? '...' : ''),
      liked: likedPostIds.includes(p.id),
    }));

    return NextResponse.json({ success: true, data: posts, page, has_more: posts.length === limit });
  } catch (err) {
    return apiError('INTERNAL_ERROR', 500, err);
  }
}

// ── POST: 게시글 작성 ────────────────────────────────────────
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? '127.0.0.1';
  if (!rateLimit(ip, { windowMs: 10 * 60 * 1000, max: 5, key: 'community-posts-write' })) return apiError('RATE_LIMITED', 429);

  let body: {
    session_id?: string; user_id?: string; nickname?: string;
    dong?: string; category?: string; title?: string; content?: string;
  };
  try { body = await req.json(); } catch { return apiError('INVALID_INPUT', 400); }

  const { session_id, user_id, nickname, dong, category, title, content } = body;

  // 검증
  if (!session_id) return apiError('SESSION_REQUIRED', 400);
  if (!title?.trim() || title.trim().length < 2 || title.trim().length > 100)
    return NextResponse.json({ success: false, message: '제목은 2~100자 사이로 입력해주세요.' }, { status: 400 });
  if (!content?.trim() || content.trim().length < 2 || content.trim().length > 3000)
    return NextResponse.json({ success: false, message: '내용은 2~3000자 사이로 입력해주세요.' }, { status: 400 });
  if (!VALID_CATEGORIES.includes(category ?? ''))
    return NextResponse.json({ success: false, message: '유효하지 않은 카테고리입니다.' }, { status: 400 });

  // HTML 태그 완전 이스케이프 (XSS 방지)
  function escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  const safeTitle   = escapeHtml(title.trim());
  const safeContent = escapeHtml(content.trim());
  const safeNick    = escapeHtml(nickname?.trim() || '익명');

  // 기본 욕설/스팸 필터 (향후 확장 용이하도록 배열로 관리)
  const BLOCKED_PATTERNS = [
    /시발|씨발|씨ㅂ|ㅅㅂ|존나|좆|보지|자지|섹스|fuck|shit|bitch/i,
    /http[s]?:\/\//i, // URL 삽입 시도 (스팸 방지)
  ];
  const combined = safeTitle + safeContent;
  if (BLOCKED_PATTERNS.some(p => p.test(combined))) {
    return NextResponse.json({ success: false, message: '부적절한 내용이 포함되어 있습니다.' }, { status: 400 });
  }

  try {
    const sb = createServiceClient();
    const { data, error } = await sb
      .from('community_posts')
      .insert({
        session_id,
        user_id:    user_id ?? null,
        nickname:   safeNick,
        dong:       dong?.trim() || '전체',
        category:   category!,
        title:      safeTitle,
        content:    safeContent,
        ip,
      })
      .select('id, title, dong, category, created_at')
      .single();

    if (error) return apiError('INTERNAL_ERROR', 500, error);
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (err) {
    return apiError('INTERNAL_ERROR', 500, err);
  }
}
