// app/api/b2b-inquiry/route.ts
// ────────────────────────────────────────────────────────────
// B2B 문의 접수
// - 입력: 회사명, 서비스 유형, 담당자명, 연락처, 문의 내용
// - 저장: Supabase b2b_inquiries 테이블
// - 알림: Resend → zntk660202@gmail.com
// - Rate Limit: IP당 시간당 3건
// ────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { apiError } from '@/lib/error-handler';
import { createServiceClient } from '@/lib/supabase';

const RESEND_API_KEY  = process.env.RESEND_API_KEY ?? '';
const ADMIN_EMAIL     = 'zntk660202@gmail.com';
const FROM_EMAIL      = 'noreply@moveiq.vercel.app';

// RFC 5321 기반 이메일 검증 (길이 + 형식 + 연속 점 방지)
function isValidEmail(email: string): boolean {
  if (email.length > 254) return false;
  const re = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  if (!re.test(email)) return false;
  if (/\.{2,}/.test(email)) return false;  // 연속 점 차단
  return true;
}

const SERVICE_TYPES = [
  'api_integration', 'white_label', 'data_partnership',
  'government', 'media', 'other',
] as const;

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? '127.0.0.1';
  // 시간당 3건 제한 (어뷰징 방지)
  if (!rateLimit(ip, { windowMs: 60 * 60 * 1000, max: 3, key: 'b2b-inquiry' })) {
    return apiError('RATE_LIMITED', 429);
  }

  let body: {
    company_name?:   string;
    service_type?:   string;
    contact_name?:   string;
    contact_phone?:  string;
    contact_email?:  string;
    message?:        string;
  };
  try { body = await req.json(); }
  catch { return apiError('INVALID_INPUT', 400); }

  // 필수 필드 검증
  const { company_name, service_type, contact_name, contact_phone, contact_email, message } = body;
  if (!company_name  || company_name.trim().length < 1   || company_name.length  > 100) return apiError('INVALID_INPUT', 400);
  if (!service_type  || !SERVICE_TYPES.includes(service_type as any))                     return apiError('INVALID_INPUT', 400);
  if (!contact_name  || contact_name.trim().length < 1   || contact_name.length  > 50)  return apiError('INVALID_INPUT', 400);
  if (!contact_phone || contact_phone.trim().length < 8   || contact_phone.length > 20)  return apiError('INVALID_INPUT', 400);
  if (!contact_email || !isValidEmail(contact_email))               return apiError('INVALID_INPUT', 400);
  if (!message       || message.trim().length < 10        || message.length > 2000)       return apiError('INVALID_INPUT', 400);

  const SERVICE_LABELS: Record<string, string> = {
    api_integration:  'API 연동 (직방·다방 등)',
    white_label:      '화이트레이블',
    data_partnership: '데이터 파트너십',
    government:       '지자체·공공기관',
    media:            '부동산 미디어·크리에이터',
    other:            '기타',
  };

  try {
    const supabase = createServiceClient();

    // DB 저장
    const { error: dbError } = await supabase.from('b2b_inquiries').insert({
      company_name:  company_name.trim(),
      service_type,
      contact_name:  contact_name.trim(),
      contact_phone: contact_phone.trim(),
      contact_email: contact_email.trim().toLowerCase(),
      message:       message.trim(),
      ip_address:    ip,
      status:        'pending',
    });

    if (dbError) return apiError('INQUIRY_SAVE_FAILED', 500, dbError);

    // 관리자 이메일 알림 (Resend)
    if (RESEND_API_KEY) {
      const html = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
  <h2 style="color:#646F4B;margin-bottom:20px;">🏢 새 B2B 문의가 접수되었습니다</h2>
  <table style="width:100%;border-collapse:collapse;">
    <tr><td style="padding:10px;background:#f5f7f3;font-weight:700;width:120px;">회사명</td><td style="padding:10px;border-bottom:1px solid #e8ebe3;">${company_name.trim()}</td></tr>
    <tr><td style="padding:10px;background:#f5f7f3;font-weight:700;">서비스 유형</td><td style="padding:10px;border-bottom:1px solid #e8ebe3;">${SERVICE_LABELS[service_type] ?? service_type}</td></tr>
    <tr><td style="padding:10px;background:#f5f7f3;font-weight:700;">담당자</td><td style="padding:10px;border-bottom:1px solid #e8ebe3;">${contact_name.trim()}</td></tr>
    <tr><td style="padding:10px;background:#f5f7f3;font-weight:700;">연락처</td><td style="padding:10px;border-bottom:1px solid #e8ebe3;">${contact_phone.trim()}</td></tr>
    <tr><td style="padding:10px;background:#f5f7f3;font-weight:700;">이메일</td><td style="padding:10px;border-bottom:1px solid #e8ebe3;">${contact_email.trim()}</td></tr>
    <tr><td style="padding:10px;background:#f5f7f3;font-weight:700;vertical-align:top;">문의 내용</td><td style="padding:10px;">${message.trim().replace(/\n/g, '<br/>')}</td></tr>
  </table>
</div>`;

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify({
          from:    `무브IQ B2B <${FROM_EMAIL}>`,
          to:      [ADMIN_EMAIL],
          reply_to: contact_email.trim(),
          subject: `[MoveIQ B2B] ${company_name.trim()} — ${SERVICE_LABELS[service_type] ?? service_type}`,
          html,
        }),
      }).catch(() => {}); // 이메일 실패해도 문의 저장은 완료
    }

    return NextResponse.json({ success: true, message: '문의가 접수되었습니다. 영업일 1~2일 내 연락드리겠습니다.' });
  } catch (err) {
    return apiError('INTERNAL_ERROR', 500, err);
  }
}
