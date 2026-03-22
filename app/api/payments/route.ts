// app/api/payments/route.ts
// ────────────────────────────────────────────────────────────
// 토스페이먼츠 결제 승인
// 보안: 클라이언트 전달 금액을 절대 신뢰하지 않고 서버 기준표로 재검증
// ────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import { apiError } from '@/lib/error-handler';
import { createServiceClient } from '@/lib/supabase';

// 서버 기준 플랜 금액표 — 프론트엔드 코드에 존재해서는 안 됨
const PLAN_PRICES: Record<string, number> = {
  move_plan_single: 4900,
  monthly_basic:   14900,
  monthly_premium: 29900,
};

export async function POST(req: NextRequest) {
  let body: { paymentKey?: string; orderId?: string; amount?: number; planCode?: string };
  try { body = await req.json(); }
  catch { return apiError('INVALID_INPUT', 400); }

  const { paymentKey, orderId, amount, planCode } = body;

  if (!paymentKey || !orderId || amount === undefined || !planCode) {
    return apiError('INVALID_INPUT', 400);
  }

  // 1. 서버 기준 금액 조회
  const expectedAmount = PLAN_PRICES[planCode];
  if (!expectedAmount) {
    return apiError('INVALID_INPUT', 400, `유효하지 않은 플랜: ${planCode}`);
  }

  // 2. 금액 무결성 검증 (핵심 보안)
  if (amount !== expectedAmount) {
    console.error(`[PAYMENT_TAMPER] orderId=${orderId} expected=${expectedAmount} received=${amount}`);
    return apiError('INVALID_INPUT', 400, '금액 불일치');
  }

  // 3. user_id 추출 (Supabase Auth JWT에서)
  const supabase = createServiceClient();
  const authHeader = req.headers.get('authorization');
  let userId: string | null = null;

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const { data: { user } } = await supabase.auth.getUser(token);
    userId = user?.id ?? null;
  }

  // 4. 중복 처리 방지
  const { data: existing } = await supabase
    .from('payments')
    .select('id')
    .eq('order_id', orderId)
    .single();

  if (existing) {
    return apiError('INVALID_INPUT', 400, '이미 처리된 주문');
  }

  // 5. 토스페이먼츠 승인 API 호출
  try {
    const tossRes = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${process.env.TOSS_PAYMENTS_SECRET_KEY}:`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    });

    if (!tossRes.ok) {
      const err = await tossRes.json();
      return apiError('INTERNAL_ERROR', 502, err);
    }

    const tossData = await tossRes.json();

    // 6. DB에 결제 기록 저장 (user_id 포함)
    const { error: dbErr } = await supabase.from('payments').insert({
      order_id:    orderId,
      payment_key: paymentKey,
      user_id:     userId,       // ✅ user_id 저장
      plan_code:   planCode,
      amount:      expectedAmount,
      status:      'paid',
      toss_data:   tossData,
      paid_at:     new Date().toISOString(),
    });

    if (dbErr) return apiError('INTERNAL_ERROR', 500, dbErr);

    return NextResponse.json({ success: true, message: '결제가 완료되었습니다.' });
  } catch (err) {
    return apiError('INTERNAL_ERROR', 500, err);
  }
}

// 토스페이먼츠 웹훅 수신 (결제 상태 동기화)
export async function PUT(req: NextRequest) {
  const signature = req.headers.get('toss-payments-signature');
  const payload   = await req.text();

  if (!signature || !process.env.TOSS_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // HMAC 서명 검증
  const crypto = await import('crypto');
  const expected = crypto
    .createHmac('sha256', process.env.TOSS_WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  const isValid = crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected),
  );

  if (!isValid) {
    console.error('[WEBHOOK] 서명 불일치');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // 웹훅 처리 로직 (상태 업데이트 등)
  const event = JSON.parse(payload);
  console.log('[WEBHOOK]', event.eventType, event.data?.orderId);

  return NextResponse.json({ success: true });
}
