// app/api/admin/reports/route.ts
// 어드민 신고 검토 큐
// GET  — 신고 목록 조회 (pending + auto_blinded)
// POST — 신고 처리 (keep=블라인드 해제, remove=확정 삭제)

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, logAdminAction } from '@/lib/admin-auth';
import { apiError }                    from '@/lib/error-handler';
import { createServiceClient }         from '@/lib/supabase';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── GET: 신고 큐 목록 ────────────────────────────────────────
export async function GET(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (admin instanceof Response) return admin;

  const status = req.nextUrl.searchParams.get('status') ?? 'pending';
  const limit  = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? 50), 100);

  try {
    const sb = createServiceClient();

    const { data, error } = await sb
      .from('admin_report_queue')
      .select('id, target_type, target_id, report_count, status, created_at, updated_at')
      .in('status', status === 'all' ? ['pending', 'auto_blinded', 'reviewed_keep', 'reviewed_remove'] : [status])
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) return apiError('INTERNAL_ERROR', 500, error);

    // 각 신고 대상의 미리보기 내용 조회
    const enriched = await Promise.all(
      (data ?? []).map(async (item) => {
        let preview = '';
        try {
          if (item.target_type === 'noise_report') {
            const { data: r } = await sb
              .from('noise_reports')
              .select('noise_type, description, is_blinded')
              .eq('id', item.target_id)
              .single();
            if (r) preview = `[${r.noise_type}] ${r.description ?? '설명 없음'} ${r.is_blinded ? '(블라인드)' : ''}`;
          } else if (item.target_type === 'community_post') {
            const { data: p } = await sb
              .from('community_posts')
              .select('title, category, is_blinded')
              .eq('id', item.target_id)
              .single();
            if (p) preview = `[${p.category}] ${p.title} ${p.is_blinded ? '(블라인드)' : ''}`;
          } else if (item.target_type === 'community_comment') {
            const { data: c } = await sb
              .from('community_comments')
              .select('content, is_blinded')
              .eq('id', item.target_id)
              .single();
            if (c) preview = `${c.content.slice(0, 60)} ${c.is_blinded ? '(블라인드)' : ''}`;
          }
        } catch { /* 미리보기 실패는 무시 */ }
        return { ...item, preview };
      }),
    );

    return NextResponse.json({ success: true, data: enriched });
  } catch (err) {
    return apiError('INTERNAL_ERROR', 500, err);
  }
}

// ── POST: 신고 처리 ──────────────────────────────────────────
export async function POST(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (admin instanceof Response) return admin;

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? '127.0.0.1';

  let body: { queue_id?: string; action?: string; note?: string };
  try { body = await req.json(); } catch { return apiError('INVALID_INPUT', 400); }

  const { queue_id, action, note } = body;
  if (!queue_id || !UUID_RE.test(queue_id))          return apiError('INVALID_INPUT', 400);
  if (!action || !['keep', 'remove'].includes(action)) return apiError('INVALID_INPUT', 400);

  try {
    const sb = createServiceClient();

    // 큐 항목 조회
    const { data: queueItem, error: qErr } = await sb
      .from('admin_report_queue')
      .select('*')
      .eq('id', queue_id)
      .single();

    if (qErr || !queueItem) return apiError('NOT_FOUND', 404);

    const newStatus = action === 'keep' ? 'reviewed_keep' : 'reviewed_remove';

    // 1. 큐 상태 업데이트
    await sb.from('admin_report_queue').update({
      status:      newStatus,
      admin_note:  note ?? null,
      reviewed_by: admin.id,
      reviewed_at: new Date().toISOString(),
      updated_at:  new Date().toISOString(),
    }).eq('id', queue_id);

    // 2. 대상 콘텐츠 처리
    if (action === 'keep') {
      // 블라인드 해제
      if (queueItem.target_type === 'noise_report') {
        await sb.from('noise_reports').update({ is_blinded: false }).eq('id', queueItem.target_id);
      } else if (queueItem.target_type === 'community_post') {
        await sb.from('community_posts').update({ is_blinded: false }).eq('id', queueItem.target_id);
      } else if (queueItem.target_type === 'community_comment') {
        await sb.from('community_comments').update({ is_blinded: false }).eq('id', queueItem.target_id);
      }
    } else {
      // 확정 삭제
      if (queueItem.target_type === 'noise_report') {
        await sb.from('noise_reports').delete().eq('id', queueItem.target_id);
      } else if (queueItem.target_type === 'community_post') {
        await sb.from('community_posts').delete().eq('id', queueItem.target_id);
      } else if (queueItem.target_type === 'community_comment') {
        await sb.from('community_comments').delete().eq('id', queueItem.target_id);
      }
    }

    // 3. 감사 로그 기록
    await logAdminAction({
      adminId:  admin.id,
      action:   action === 'keep' ? 'blind_restore' : 'content_remove',
      targetId: queueItem.target_id,
      detail:   { queue_id, target_type: queueItem.target_type, note },
      ip,
    });

    return NextResponse.json({ success: true, status: newStatus });
  } catch (err) {
    return apiError('INTERNAL_ERROR', 500, err);
  }
}
