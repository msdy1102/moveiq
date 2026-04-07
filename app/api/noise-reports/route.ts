// app/api/noise-reports/route.ts
// ────────────────────────────────────────────────────────────
// 소음 제보 저장
// - 위치 50m 랜덤화 (개인정보 보호)
// - Rate Limit: IP당 10분에 5건
// - 사진 첨부: MIME 서버 재검증 → Supabase Storage 업로드
// ────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { apiError } from '@/lib/error-handler';
import { createServiceClient } from '@/lib/supabase';

// 허용 소음 유형
const VALID_TYPES = ['construction', 'entertainment', 'floor', 'traffic', 'other'] as const;
const VALID_TIMES = ['dawn', 'morning', 'afternoon', 'evening', 'night'] as const;
// 허용 MIME
const ALLOWED_MIME = ['image/jpeg', 'image/png'] as const;
const MAX_PHOTO_SIZE = 5 * 1024 * 1024; // 5MB

// JPEG/PNG 매직 바이트 검증 (Content-Type 스푸핑 방지)
function isValidImageBuffer(buf: Buffer, mimeType: string): boolean {
  if (mimeType === 'image/jpeg') {
    return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  }
  if (mimeType === 'image/png') {
    return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  }
  return false;
}

export async function POST(req: NextRequest) {
  // Rate Limit
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? '127.0.0.1';
  if (!rateLimit(ip, { windowMs: 10 * 60 * 1000, max: 5, key: 'noise-reports' })) {
    return apiError('RATE_LIMITED', 429);
  }

  const contentType = req.headers.get('content-type') ?? '';
  const isMultipart = contentType.includes('multipart/form-data');

  let noise_type: string | undefined;
  let time_slot:  string | undefined;
  let severity:   number | undefined;
  let lat:        number | undefined;
  let lng:        number | undefined;
  let description: string | undefined;
  let photoUrl:   string | null = null;

  // ── multipart 처리 ─────────────────────────────────────
  if (isMultipart) {
    let formData: FormData;
    try { formData = await req.formData(); }
    catch { return apiError('INVALID_INPUT', 400); }

    noise_type  = formData.get('noise_type')  as string;
    time_slot   = formData.get('time_slot')   as string;
    severity    = Number(formData.get('severity'));
    lat         = Number(formData.get('lat'));
    lng         = Number(formData.get('lng'));
    description = (formData.get('description') as string) || '';

    const photo = formData.get('photo') as File | null;
    if (photo && photo.size > 0) {
      // 1. MIME 클라이언트 선언 검증
      if (!ALLOWED_MIME.includes(photo.type as any)) return apiError('INVALID_FILE_TYPE', 400);
      // 2. 크기 검증
      if (photo.size > MAX_PHOTO_SIZE) return apiError('FILE_TOO_LARGE', 400);
      // 3. 매직 바이트 검증 (서버 사이드 재검증)
      const arrayBuf = await photo.arrayBuffer();
      const buf = Buffer.from(arrayBuf);
      if (!isValidImageBuffer(buf, photo.type)) return apiError('INVALID_FILE_TYPE', 400);

      // 4. Supabase Storage 업로드
      const supabase = createServiceClient();
      const ext      = photo.type === 'image/png' ? 'png' : 'jpg';
      const fileName = `noise/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('noise-photos')
        .upload(fileName, buf, { contentType: photo.type, upsert: false });

      if (uploadError) {
        // 업로드 실패해도 제보 자체는 사진 없이 저장 (비필수 항목)
        console.error('Photo upload failed:', uploadError.message);
      } else {
        const { data: urlData } = supabase.storage.from('noise-photos').getPublicUrl(fileName);
        photoUrl = urlData?.publicUrl ?? null;
      }
    }
  } else {
    // ── JSON 처리 (사진 없는 기존 경로) ────────────────
    let body: { noise_type?: string; time_slot?: string; severity?: number; lat?: number; lng?: number; description?: string; };
    try { body = await req.json(); }
    catch { return apiError('INVALID_INPUT', 400); }
    noise_type  = body.noise_type;
    time_slot   = body.time_slot;
    severity    = body.severity;
    lat         = body.lat;
    lng         = body.lng;
    description = body.description;
  }

  // ── 공통 입력 검증 ──────────────────────────────────
  if (!VALID_TYPES.includes(noise_type as any)) return apiError('INVALID_INPUT', 400);
  if (!VALID_TIMES.includes(time_slot  as any)) return apiError('INVALID_INPUT', 400);
  if (!severity || severity < 1 || severity > 5) return apiError('INVALID_INPUT', 400);
  if (lat === undefined || lng === undefined || isNaN(lat) || isNaN(lng)) return apiError('INVALID_INPUT', 400);
  if (description && description.length > 100) return apiError('INVALID_INPUT', 400);

  // 위치 50m 랜덤화 (개인정보 보호)
  const jitterLat = (Math.random() - 0.5) * 0.0009;
  const jitterLng = (Math.random() - 0.5) * 0.0009;

  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from('noise_reports').insert({
      noise_type:  noise_type,
      time_slot:   time_slot,
      severity:    severity,
      lat:         lat  + jitterLat,
      lng:         lng  + jitterLng,
      description: description ?? null,
      photo_url:   photoUrl,
      reporter_ip: ip,
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
