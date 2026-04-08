// app/api/noise-reports/report/route.ts
// 소음 제보 신고 처리
// - IP당 동일 제보 중복 신고 방지 (DB unique constraint)
// - 3건 누적 시 DB 트리거가 자동 블라인드 처리 (auto_blind_noise_report)
// - Rate Limit: IP당 10분 5건

import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { apiError } from '@/lib/error-handler';
import { createServiceClient } from '@/lib/supabase';

const VALID_REASONS = ['fake', 'spam', 'inappropriate', 'duplicate', 'other'] as const;

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? '127.0.0.1';

  // Rate Limit: 10분 5건
  if (!rateLimit(ip, { windowMs: 10 * 60 * 1000, max: 5, key: 'noise-report-flag' })) {
    return apiError('RATE_LIMITED', 429);
  }

  let body: { noise_report_id?: string; reason?: string; user_id?: string };
  try { body = await req.json(); }
  catch { return apiError('INVALID_INPUT', 400); }

  const { noise_report_id, reason, user_id } = body;

  // 입력 검증
  if (!noise_report_id || typeof noise_report_id !== 'string') {
    return apiError('INVALID_INPUT', 400);
  }
  if (!reason || !VALID_REASONS.includes(reason as any)) {
    return apiError('INVALID_INPUT', 400);
  }

  // UUID 형식 검증
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(noise_report_id)) {
    return apiError('INVALID_INPUT', 400);
  }

  try {
    const supabase = createServiceClient();

    // 해당 제보가 실제로 존재하는지 확인
    const { data: report, error: findErr } = await supabase
      .from('noise_reports')
      .select('id, is_blinded, report_count')
      .eq('id', noise_report_id)
      .single();

    if (findErr || !report) {
      return apiError('NOT_FOUND', 404);
    }

    // 이미 블라인드 된 제보
    if (report.is_blinded) {
      return NextResponse.json({
        success: true,
        message: '이미 처리된 제보입니다.',
        blinded: true,
      });
    }

    // 신고 삽입 (중복 신고는 DB unique constraint가 막음)
    const { error: insertErr } = await supabase
      .from('noise_report_flags')
      .insert({
        noise_report_id,
        reporter_ip: ip,
        reporter_id: user_id ?? null,
        reason,
      });

    if (insertErr) {
      // 중복 신고 (unique violation: code 23505)
      if (insertErr.code === '23505') {
        return NextResponse.json({
          success: false,
          message: '이미 신고한 제보입니다.',
          already_reported: true,
        });
      }
      return apiError('INTERNAL_ERROR', 500, insertErr);
    }

    // 현재 신고 수 조회 (트리거가 이미 처리했으므로 최신 상태 확인)
    const { data: updated } = await supabase
      .from('noise_reports')
      .select('report_count, is_blinded')
      .eq('id', noise_report_id)
      .single();

    return NextResponse.json({
      success: true,
      message: '신고가 접수되었습니다. 검토 후 처리됩니다.',
      report_count: updated?.report_count ?? (report.report_count + 1),
      blinded: updated?.is_blinded ?? false,
    });

  } catch (err) {
    return apiError('INTERNAL_ERROR', 500, err);
  }
}
