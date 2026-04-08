// app/api/community/report/route.ts
// 커뮤니티 게시글 / 댓글 신고 처리
// - target_type: 'post' | 'comment'
// - 3건 누적 시 DB 트리거가 자동 블라인드
// - Rate Limit: IP당 10분 5건

import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { apiError } from '@/lib/error-handler';
import { createServiceClient } from '@/lib/supabase';

const VALID_TARGET_TYPES = ['post', 'comment'] as const;
const VALID_REASONS = ['fake', 'spam', 'inappropriate', 'defamation', 'duplicate', 'other'] as const;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? '127.0.0.1';

  if (!rateLimit(ip, { windowMs: 10 * 60 * 1000, max: 5, key: 'community-report-flag' })) {
    return apiError('RATE_LIMITED', 429);
  }

  let body: {
    target_type?: string;
    target_id?:   string;
    reason?:      string;
    user_id?:     string;
  };
  try { body = await req.json(); }
  catch { return apiError('INVALID_INPUT', 400); }

  const { target_type, target_id, reason, user_id } = body;

  if (!target_type || !VALID_TARGET_TYPES.includes(target_type as any)) return apiError('INVALID_INPUT', 400);
  if (!target_id   || !UUID_RE.test(target_id))                          return apiError('INVALID_INPUT', 400);
  if (!reason      || !VALID_REASONS.includes(reason as any))            return apiError('INVALID_INPUT', 400);

  try {
    const supabase = createServiceClient();

    // 대상 존재 + 블라인드 상태 확인
    const table = target_type === 'post' ? 'community_posts' : 'community_comments';
    const { data: target, error: findErr } = await supabase
      .from(table)
      .select('id, is_blinded, report_count')
      .eq('id', target_id)
      .single();

    if (findErr || !target) return apiError('NOT_FOUND', 404);

    if (target.is_blinded) {
      return NextResponse.json({ success: true, message: '이미 처리된 콘텐츠입니다.', blinded: true });
    }

    // 신고 삽입
    const { error: insertErr } = await supabase
      .from('community_report_flags')
      .insert({
        target_type,
        target_id,
        reporter_ip: ip,
        reporter_id: user_id ?? null,
        reason,
      });

    if (insertErr) {
      if (insertErr.code === '23505') {
        return NextResponse.json({
          success: false,
          message: '이미 신고한 콘텐츠입니다.',
          already_reported: true,
        });
      }
      return apiError('INTERNAL_ERROR', 500, insertErr);
    }

    // 처리 결과 확인
    const { data: updated } = await supabase
      .from(table)
      .select('report_count, is_blinded')
      .eq('id', target_id)
      .single();

    return NextResponse.json({
      success: true,
      message: '신고가 접수되었습니다. 검토 후 처리됩니다.',
      report_count: updated?.report_count ?? (target.report_count + 1),
      blinded: updated?.is_blinded ?? false,
    });

  } catch (err) {
    return apiError('INTERNAL_ERROR', 500, err);
  }
}
