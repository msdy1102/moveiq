// app/api/resident-verify/route.ts
// 주민 인증 — GPS 방식 + 계약 정보 방식
// 기획서 명세:
//   GPS: 행정동 반경 500m 이내 확인
//   계약: 계약날짜·금액·사는 동/호수·전세/매매 선택 → 추후 공공데이터 비교
import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { apiError } from '@/lib/error-handler';
import { createServiceClient } from '@/lib/supabase';

// ── 행정동 중심 좌표 → 반경 내 여부 계산 ──────────────────────
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R    = 6371000; // 지구 반지름 (m)
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a    =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── 역지오코딩 → 행정동 추출 ─────────────────────────────────
async function reverseGeocodeToDong(lat: number, lng: number): Promise<{
  dong: string; gu: string; fullAddress: string;
} | null> {
  const clientId     = process.env.NAVER_MAP_CLIENT_ID;
  const clientSecret = process.env.NAVER_MAP_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  try {
    const res = await fetch(
      `https://naveropenapi.apigw.ntruss.com/map-reversegeocode/v2/gc` +
      `?coords=${lng},${lat}&sourcecrs=epsg:4326&orders=addr&output=json`,
      {
        headers: {
          'X-NCP-APIGW-API-KEY-ID': clientId,
          'X-NCP-APIGW-API-KEY':    clientSecret,
        },
        signal: AbortSignal.timeout(5000),
      }
    );
    if (!res.ok) return null;

    const data    = await res.json();
    const results = data.results ?? [];
    const item    = results.find((r: any) => r.name === 'addr') ?? results[0];
    if (!item) return null;

    const r = item.region;
    // area3 = 법정동 / area4 = 행정동(리)
    const dong = r?.area4?.name || r?.area3?.name || '';
    const gu   = r?.area2?.name || '';
    const fullAddress = [r?.area1?.name, gu, dong].filter(Boolean).join(' ');

    return { dong, gu, fullAddress };
  } catch { return null; }
}

// ── GPS 기반 인증 ─────────────────────────────────────────────
async function verifyByGPS(
  supabase: ReturnType<typeof createServiceClient>,
  {
    session_id, user_id, lat, lng, claimed_dong, ip,
  }: {
    session_id: string; user_id?: string;
    lat: number; lng: number; claimed_dong: string; ip: string;
  }
): Promise<{
  success:    boolean;
  status:     'verified' | 'rejected';
  dong?:      string;
  gu?:        string;
  distance?:  number;
  message:    string;
}> {
  // 1. 현재 위치의 행정동 조회
  const geoResult = await reverseGeocodeToDong(lat, lng);
  if (!geoResult) {
    return { success: false, status: 'rejected', message: '위치 정보를 확인할 수 없습니다. 잠시 후 다시 시도해주세요.' };
  }

  const { dong, gu, fullAddress } = geoResult;

  // 2. 주장하는 동네와 실제 위치 동네 비교
  //    - 완전 일치 또는 포함 관계 확인
  const claimedClean = claimed_dong.replace(/(동|읍|면|리)$/, '');
  const actualClean  = dong.replace(/(동|읍|면|리)$/, '');

  const dongMatch = dong.includes(claimedClean) || claimedClean.includes(actualClean) ||
                    dong === claimed_dong || claimed_dong.includes(dong);

  if (!dongMatch) {
    // DB에 실패 기록 저장
    await supabase.from('resident_verifications').insert({
      session_id, user_id: user_id ?? null,
      method:         'gps',
      verified_lat:   lat,
      verified_lng:   lng,
      verified_dong:  dong,
      verified_gu:    gu,
      status:         'rejected',
      reject_reason:  `GPS 위치(${fullAddress})가 주장한 동네(${claimed_dong})와 다릅니다.`,
      ip,
    });
    return {
      success: false, status: 'rejected',
      dong, gu,
      message: `현재 위치(${dong})가 주장하신 동네(${claimed_dong})와 다릅니다. 해당 동네에서 다시 시도해주세요.`,
    };
  }

  // 3. 인증 성공 — DB 저장 + profiles 업데이트
  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

  await supabase.from('resident_verifications').insert({
    session_id, user_id: user_id ?? null,
    method:         'gps',
    verified_lat:   lat,
    verified_lng:   lng,
    verified_dong:  dong,
    verified_gu:    gu,
    status:         'verified',
    verified_at:    new Date().toISOString(),
    expires_at:     expiresAt,
    ip,
  });

  // profiles 업데이트 (로그인 유저)
  if (user_id) {
    await supabase.from('profiles').update({
      is_resident:         true,
      verified_dong:       dong,
      resident_expires_at: expiresAt,
      updated_at:          new Date().toISOString(),
    }).eq('id', user_id);
  }

  // 인증된 동네의 기존 커뮤니티 게시글/댓글 is_verified 업데이트
  if (user_id) {
    await supabase.from('community_posts')
      .update({ is_verified: true })
      .eq('user_id', user_id);
    await supabase.from('community_comments')
      .update({ is_verified: true })
      .eq('user_id', user_id);
  }

  return {
    success: true, status: 'verified',
    dong, gu,
    message: `${dong} 주민 인증이 완료되었습니다! 🏠 배지가 부여되었습니다.`,
  };
}

// ── 계약 정보 기반 인증 ───────────────────────────────────────
async function verifyByContract(
  supabase: ReturnType<typeof createServiceClient>,
  {
    session_id, user_id,
    contract_date, contract_amount, contract_dong,
    contract_type, claimed_dong, ip,
  }: {
    session_id: string; user_id?: string;
    contract_date: string; contract_amount: number;
    contract_dong: string; contract_type: string;
    claimed_dong: string; ip: string;
  }
): Promise<{
  success:  boolean;
  status:   'pending' | 'verified' | 'rejected';
  message:  string;
}> {
  // Phase 1 (현재): 계약 정보를 받아서 pending 처리
  // Phase 2 (추후): 공공데이터(국토교통부 실거래가 API)와 비교 검증

  // 기본 유효성 검증
  if (!contract_date || !contract_amount || !contract_dong || !contract_type) {
    return { success: false, status: 'rejected', message: '모든 계약 정보를 입력해주세요.' };
  }

  // 계약 날짜 미래 날짜 차단
  if (new Date(contract_date) > new Date()) {
    return { success: false, status: 'rejected', message: '계약 날짜가 미래일 수 없습니다.' };
  }

  // DB 저장 (pending 상태 — 추후 공공데이터 배치로 처리)
  const { data, error } = await supabase.from('resident_verifications').insert({
    session_id,
    user_id:          user_id ?? null,
    method:           'contract',
    verified_dong:    claimed_dong,
    contract_date,
    contract_amount,
    contract_dong,
    contract_type,
    status:           'pending',
    ip,
  }).select('id').single();

  if (error) {
    return { success: false, status: 'rejected', message: '인증 요청 저장에 실패했습니다.' };
  }

  // Phase 1: 계약 정보 제출 시 임시 인증 부여 (베타 기간)
  // 실제 서비스에서는 공공데이터 검증 후 confirmed 처리 필요
  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
  await supabase.from('resident_verifications').update({
    status:      'verified',
    verified_at: new Date().toISOString(),
    expires_at:  expiresAt,
    match_detail: { phase: 1, note: '베타: 계약 정보 제출로 임시 인증' },
  }).eq('id', data.id);

  if (user_id) {
    await supabase.from('profiles').update({
      is_resident:         true,
      verified_dong:       claimed_dong,
      resident_expires_at: expiresAt,
      updated_at:          new Date().toISOString(),
    }).eq('id', user_id);

    await supabase.from('community_posts').update({ is_verified: true }).eq('user_id', user_id);
    await supabase.from('community_comments').update({ is_verified: true }).eq('user_id', user_id);
  }

  return {
    success: true, status: 'verified',
    message: `${claimed_dong} 주민 인증이 완료되었습니다! 🏠 배지가 부여되었습니다. (베타: 계약 정보 기반 인증)`,
  };
}

// ── POST: 인증 요청 ──────────────────────────────────────────
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? '127.0.0.1';
  if (!rateLimit(ip, { windowMs: 60 * 60 * 1000, max: 5, key: 'resident-verify' })) {
    return NextResponse.json({ success: false, message: '인증 시도 횟수를 초과했습니다. 1시간 후 다시 시도해주세요.' }, { status: 429 });
  }

  let body: {
    method?:          string;
    session_id?:      string;
    user_id?:         string;
    claimed_dong?:    string;
    // GPS
    lat?:             number;
    lng?:             number;
    // 계약 정보
    contract_date?:   string;
    contract_amount?: number;
    contract_dong?:   string;
    contract_type?:   string;
  };
  try { body = await req.json(); } catch { return apiError('INVALID_INPUT', 400); }

  const { method, session_id, user_id, claimed_dong } = body;

  if (!method || !session_id || !claimed_dong) {
    return NextResponse.json({ success: false, message: '필수 정보가 누락되었습니다.' }, { status: 400 });
  }
  if (!['gps', 'contract'].includes(method)) {
    return NextResponse.json({ success: false, message: '유효하지 않은 인증 방식입니다.' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // 이미 인증된 경우 확인
  if (user_id) {
    const { data: existing } = await supabase
      .from('resident_verifications')
      .select('id, status, verified_dong, expires_at')
      .eq('user_id', user_id)
      .eq('status', 'verified')
      .gte('expires_at', new Date().toISOString())
      .single();

    if (existing) {
      return NextResponse.json({
        success:  true,
        status:   'already_verified',
        dong:     existing.verified_dong,
        message:  `이미 ${existing.verified_dong} 주민으로 인증되어 있습니다. (${new Date(existing.expires_at!).toLocaleDateString('ko-KR')}까지 유효)`,
      });
    }
  }

  // 방식별 분기
  if (method === 'gps') {
    const { lat, lng } = body;
    if (lat === undefined || lng === undefined || isNaN(lat) || isNaN(lng)) {
      return NextResponse.json({ success: false, message: 'GPS 좌표가 필요합니다.' }, { status: 400 });
    }
    const result = await verifyByGPS(supabase, { session_id, user_id, lat, lng, claimed_dong, ip });
    return NextResponse.json(result, { status: result.success ? 200 : 422 });

  } else {
    const { contract_date, contract_amount, contract_dong, contract_type } = body;
    if (!contract_date || !contract_amount || !contract_dong || !contract_type) {
      return NextResponse.json({ success: false, message: '계약 정보를 모두 입력해주세요.' }, { status: 400 });
    }
    const result = await verifyByContract(supabase, {
      session_id, user_id, claimed_dong, ip,
      contract_date, contract_amount, contract_dong, contract_type,
    });
    return NextResponse.json(result, { status: result.success ? 200 : 422 });
  }
}

// ── GET: 인증 상태 조회 ──────────────────────────────────────
export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? '127.0.0.1';
  if (!rateLimit(ip, { windowMs: 60 * 1000, max: 30, key: 'resident-verify' })) return apiError('RATE_LIMITED', 429);

  const sessionId = req.nextUrl.searchParams.get('session_id');
  const userId    = req.nextUrl.searchParams.get('user_id');
  if (!sessionId && !userId) return apiError('INVALID_INPUT', 400);

  try {
    const supabase = createServiceClient();

    // profiles에서 직접 조회 (가장 빠름)
    if (userId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_resident, verified_dong, resident_expires_at')
        .eq('id', userId)
        .single();

      if (profile) {
        const isActive = profile.is_resident &&
          (!profile.resident_expires_at || new Date(profile.resident_expires_at) > new Date());
        return NextResponse.json({
          success:      true,
          is_verified:  isActive,
          verified_dong: isActive ? profile.verified_dong : null,
          expires_at:   profile.resident_expires_at,
        });
      }
    }

    // session_id 기반 조회 (비로그인)
    const { data } = await supabase
      .from('resident_verifications')
      .select('status, verified_dong, verified_gu, expires_at, method')
      .eq('session_id', sessionId!)
      .eq('status', 'verified')
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    return NextResponse.json({
      success:       true,
      is_verified:   !!data,
      verified_dong: data?.verified_dong ?? null,
      expires_at:    data?.expires_at ?? null,
      method:        data?.method ?? null,
    });
  } catch {
    return NextResponse.json({ success: true, is_verified: false, verified_dong: null });
  }
}
