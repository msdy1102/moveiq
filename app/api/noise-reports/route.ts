// app/api/noise-reports/route.ts
// ────────────────────────────────────────────────────────────
// 소음 제보 저장
// - 위치 50m 랜덤화 (개인정보 보호)
// - Rate Limit: IP당 10분에 5건
// ────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { apiError } from '@/lib/error-handler';
import { createServiceClient } from '@/lib/supabase';

// 허용 소음 유형
const VALID_TYPES = ['construction', 'entertainment', 'floor', 'traffic', 'other'] as const;
const VALID_TIMES = ['dawn', 'morning', 'afternoon', 'evening', 'night'] as const;

export async function POST(req: NextRequest) {
  // Rate Limit: IP당 10분에 5건
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? '127.0.0.1';
  if (!rateLimit(ip, { windowMs: 10 * 60 * 1000, max: 5 })) {
    return apiError('RATE_LIMITED', 429);
  }

  let body: {
    noise_type?: string;
    time_slot?: string;
    severity?: number;
    lat?: number;
    lng?: number;
    description?: string;
  };

  try { body = await req.json(); }
  catch { return apiError('INVALID_INPUT', 400); }

  // 입력 검증
  if (!VALID_TYPES.includes(body.noise_type as any)) return apiError('INVALID_INPUT', 400);
  if (!VALID_TIMES.includes(body.time_slot as any))  return apiError('INVALID_INPUT', 400);
  if (!body.severity || body.severity < 1 || body.severity > 5) return apiError('INVALID_INPUT', 400);
  if (body.lat === undefined || body.lng === undefined)          return apiError('INVALID_INPUT', 400);
  if (body.description && body.description.length > 100)         return apiError('INVALID_INPUT', 400);

  // 위치 50m 랜덤화 (개인정보 보호 + 허위 방지)
  // 위도/경도 0.0005 ≈ 약 55m
  const jitterLat = (Math.random() - 0.5) * 0.0009;
  const jitterLng = (Math.random() - 0.5) * 0.0009;

  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from('noise_reports').insert({
      noise_type:  body.noise_type,
      time_slot:   body.time_slot,
      severity:    body.severity,
      lat:         body.lat  + jitterLat,
      lng:         body.lng  + jitterLng,
      description: body.description ?? null,
      reporter_ip: ip, // 어뷰징 감지용 (해시 처리 권장)
    });

    if (error) return apiError('REPORT_SAVE_FAILED', 500, error);

    return NextResponse.json({ success: true, message: '제보가 저장되었습니다.' });
  } catch (err) {
    return apiError('INTERNAL_ERROR', 500, err);
  }
}

// 소음 제보 목록 조회 (50m 랜덤화 뷰 사용, 반경 2km 필터)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat  = parseFloat(searchParams.get('lat')  ?? '37.5665');
  const lng  = parseFloat(searchParams.get('lng')  ?? '126.9780');
  const type = searchParams.get('type');

  try {
    const supabase = createServiceClient();

    // 위도/경도 2km 범위 근사 필터 (1도 ≈ 111km)
    const delta = 0.018; // 약 2km
    let query = supabase
      .from('noise_reports_public_view')
      .select('id, noise_type, time_slot, severity, lat, lng, created_at')
      .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
      .gte('lat', lat - delta)
      .lte('lat', lat + delta)
      .gte('lng', lng - delta)
      .lte('lng', lng + delta)
      .limit(300);

    if (type) query = query.eq('noise_type', type);

    const { data, error } = await query;
    if (error) return apiError('INTERNAL_ERROR', 500, error);

    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (err) {
    return apiError('INTERNAL_ERROR', 500, err);
  }
}
