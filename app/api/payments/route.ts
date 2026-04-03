// app/api/payments/route.ts — v5
// 결제 완료 후 profiles.plan 업그레이드 추가
import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { apiError } from '@/lib/error-handler';
import { createServiceClient } from '@/lib/supabase';

// ── 플랜 금액·설정 테이블 ─────────────────────────────────────
const PLAN_CONFIG: Record<string, {
  amount:    number;
  plan:      string;    // profiles.plan 값
  duration:  number | null;  // 구독 기간(일), null = 1회성
  one_time_count: number;    // one_time 플랜 횟수 부여
}> = {
  move_plan_single: { amount: 4900,  plan: 'one_time', duration: null, one_time_count: 1 },
  monthly_basic:    { amount: 14900, plan: 'premium',  duration: 30,   one_time_count: 0 },
  monthly_premium:  { amount: 29900, plan: 'premium',  duration: 30,   one_time_count: 0 },
};

export async function POST(req: NextRequest) {
  let body: {
    paymentKey?: string;
    orderId?:    string;
    amount?:     number;
    planCode?:   string;
    userId?:     string;   // Supabase auth UID
  };
  try { body = await req.json(); }
  catch { return apiError('INVALID_INPUT', 400); }

  const { paymentKey, orderId, amount, planCode, userId } = body;
  if (!paymentKey || !orderId || amount === undefined || !planCode) {
    return apiError('INVALID_INPUT', 400);
  }

  // 1. 서버 기준 금액·설정 검증
  const config = PLAN_CONFIG[planCode];
  if (!config) return apiError('INVALID_INPUT', 400, `유효하지 않은 플랜: ${planCode}`);
  if (amount !== config.amount) {
    console.error(`[PAYMENT_TAMPER] orderId=${orderId} expected=${config.amount} received=${amount}`);
    return apiError('INVALID_INPUT', 400, '금액 불일치');
  }

  const supabase = createServiceClient();

  // 2. 중복 처리 방지
  const { data: existing } = await supabase
    .from('payments')
    .select('id')
    .eq('order_id', orderId)
    .single();
  if (existing) return apiError('INVALID_INPUT', 400, '이미 처리된 주문');

  // 3. 토스페이먼츠 승인
  try {
    const tossRes = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: {
        Authorization:  `Basic ${Buffer.from(`${process.env.TOSS_PAYMENTS_SECRET_KEY}:`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    });

    if (!tossRes.ok) {
      const err = await tossRes.json();
      return apiError('INTERNAL_ERROR', 502, err);
    }
    const tossData = await tossRes.json();

    // 4. payments 테이블 저장
    const { error: dbErr } = await supabase.from('payments').insert({
      order_id:    orderId,
      payment_key: paymentKey,
      user_id:     userId ?? null,
      plan_code:   planCode,
      amount:      config.amount,
      status:      'paid',
      toss_data:   tossData,
      paid_at:     new Date().toISOString(),
    });
    if (dbErr) return apiError('INTERNAL_ERROR', 500, dbErr);

    // 5. ── 플랜 업그레이드 ─────────────────────────────────
    if (userId) {
      const now = new Date();
      const profileUpdate: Record<string, any> = {
        plan:          config.plan,
        updated_at:    now.toISOString(),
      };

      if (config.plan === 'premium' && config.duration) {
        const expiresAt = new Date(now.getTime() + config.duration * 24 * 60 * 60 * 1000);
        profileUpdate.plan_expires_at = expiresAt.toISOString();
      } else {
        profileUpdate.plan_expires_at = null;
      }

      if (config.plan === 'one_time') {
        // one_time: 기존 잔여 횟수에 추가
        const { data: cur } = await supabase
          .from('profiles')
          .select('analysis_count')
          .eq('id', userId)
          .single();
        profileUpdate.analysis_count = (cur?.analysis_count ?? 0) + config.one_time_count;
      }

      await supabase.from('profiles').upsert({ id: userId, ...profileUpdate });
    }

    return NextResponse.json({ success: true, message: '결제가 완료되었습니다.', plan: config.plan });
  } catch (err) {
    return apiError('INTERNAL_ERROR', 500, err);
  }
}

// ── 토스 웹훅 (결제 상태 동기화) ────────────────────────────
export async function PUT(req: NextRequest) {
  const signature = req.headers.get('toss-payments-signature');
  const body      = await req.text();

  if (!signature || !process.env.TOSS_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const expected = createHmac('sha256', process.env.TOSS_WEBHOOK_SECRET)
    .update(body)
    .digest('base64');
  if (signature !== expected) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  try {
    const event = JSON.parse(body);
    const supabase = createServiceClient();

    if (event.eventType === 'PAYMENT_STATUS_CHANGED') {
      const { orderId, status } = event.data;
      await supabase
        .from('payments')
        .update({ status: status.toLowerCase(), updated_at: new Date().toISOString() })
        .eq('order_id', orderId);

      // 결제 취소 시 플랜 다운그레이드
      if (status === 'CANCELED') {
        const { data: payment } = await supabase
          .from('payments')
          .select('user_id')
          .eq('order_id', orderId)
          .single();
        if (payment?.user_id) {
          await supabase
            .from('profiles')
            .update({ plan: 'free', plan_expires_at: null, updated_at: new Date().toISOString() })
            .eq('id', payment.user_id);
        }
      }
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: 'Parse error' }, { status: 400 });
  }
}
