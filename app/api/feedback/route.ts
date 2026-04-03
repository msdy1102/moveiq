// app/api/feedback/route.ts
// 불편사항 접수 — Supabase feedbacks 테이블 저장 + 선택적 이메일 발송
import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { apiError } from '@/lib/error-handler';
import { createServiceClient } from '@/lib/supabase';

const VALID_TYPES = ['버그 신고', '기능 건의', '데이터 오류', '기타 불편'] as const;

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? '127.0.0.1';
  // Rate Limit: IP당 1시간에 10건
  if (!rateLimit(ip, { windowMs: 60 * 60 * 1000, max: 10 })) {
    return apiError('RATE_LIMITED', 429);
  }

  let body: { type?: string; text?: string; email?: string; session_id?: string };
  try { body = await req.json(); } catch { return apiError('INVALID_INPUT', 400); }

  const { type, text, email, session_id } = body;

  if (!type || !VALID_TYPES.includes(type as any)) return apiError('INVALID_INPUT', 400);
  if (!text?.trim() || text.length > 2000)          return apiError('INVALID_INPUT', 400);
  if (email && email.length > 200)                  return apiError('INVALID_INPUT', 400);

  const userAgent = req.headers.get('user-agent') ?? '';

  try {
    const sb = createServiceClient();

    // ── 1. Supabase DB 저장 ─────────────────────────────────
    const { data: feedback, error: dbError } = await sb
      .from('feedbacks')
      .insert({
        session_id: session_id ?? null,
        type,
        content:    text.trim(),
        email:      email?.trim() || null,
        status:     'pending',
        ip,
        user_agent: userAgent,
      })
      .select('id')
      .single();

    if (dbError) {
      console.error('[feedback] DB 저장 오류:', dbError.message);
      // DB 저장 실패해도 이메일은 시도
    }

    // ── 2. Resend 이메일 발송 (선택) ────────────────────────
    const RESEND_KEY = process.env.RESEND_API_KEY;
    if (RESEND_KEY) {
      const emailBody = [
        `유형: ${type}`,
        `ID: ${feedback?.id ?? '저장 실패'}`,
        ``,
        `내용:`,
        text.trim(),
        ``,
        email ? `답변 이메일: ${email}` : '답변 이메일: 없음',
        ``,
        `IP: ${ip}`,
        `UA: ${userAgent.slice(0, 100)}`,
      ].join('\n');

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${RESEND_KEY}`,
        },
        body: JSON.stringify({
          from:    'noreply@moveiq.co.kr',
          to:      ['admin@moveiq.co.kr'],
          subject: `[무브IQ 불편사항] ${type}`,
          text:    emailBody,
        }),
      }).catch(e => console.error('[feedback] 이메일 발송 오류:', e));
    }

    return NextResponse.json({ success: true, id: feedback?.id });
  } catch (err) {
    return apiError('INTERNAL_ERROR', 500, err);
  }
}

// 본인 제출 내역 조회 (선택적 — 향후 마이페이지 연동용)
export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? '127.0.0.1';
  if (!rateLimit(ip, { windowMs: 60 * 1000, max: 30 })) return apiError('RATE_LIMITED', 429);

  const sessionId = req.nextUrl.searchParams.get('session_id');
  if (!sessionId) return apiError('SESSION_REQUIRED', 400);

  try {
    const sb = createServiceClient();
    const { data } = await sb
      .from('feedbacks')
      .select('id, type, content, status, created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(20);

    return NextResponse.json({ success: true, data: data ?? [] });
  } catch {
    return NextResponse.json({ success: true, data: [] });
  }
}
