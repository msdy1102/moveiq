// app/api/admin/stats/route.ts
// 어드민 대시보드 통계 조회
// - 대기 신고 수, 오늘 소음 제보, 구독자 수, 오늘 AI 분석 수
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin }        from '@/lib/admin-auth';
import { apiError }           from '@/lib/error-handler';
import { createServiceClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (admin instanceof Response) return admin;

  try {
    const sb    = createServiceClient();
    const today = new Date().toISOString().slice(0, 10);

    const [
      { count: pendingReports },
      { count: todayNoise },
      { count: totalSubscribers },
      { count: todayAnalysis },
      { count: totalNoise },
      { count: autoBlinded },
    ] = await Promise.all([
      // 대기 중 신고
      sb.from('admin_report_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending'),
      // 오늘 소음 제보
      sb.from('noise_reports')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', `${today}T00:00:00Z`),
      // 유료 구독자 (free 제외)
      sb.from('profiles')
        .select('*', { count: 'exact', head: true })
        .neq('plan', 'free'),
      // 오늘 AI 분석
      sb.from('analysis_history')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', `${today}T00:00:00Z`),
      // 소음 제보 누적
      sb.from('noise_reports')
        .select('*', { count: 'exact', head: true }),
      // 자동 블라인드 대기
      sb.from('admin_report_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'auto_blinded'),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        pending_reports:   pendingReports   ?? 0,
        auto_blinded:      autoBlinded      ?? 0,
        today_noise:       todayNoise       ?? 0,
        total_noise:       totalNoise       ?? 0,
        total_subscribers: totalSubscribers ?? 0,
        today_analysis:    todayAnalysis    ?? 0,
      },
    });
  } catch (err) {
    return apiError('INTERNAL_ERROR', 500, err);
  }
}
