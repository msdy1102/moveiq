// app/api/cron/weekly-report/route.ts
// ────────────────────────────────────────────────────────────
// 주간 동네 소음 리포트 이메일 발송 (Cron)
// - Vercel Cron: 매주 월요일 09:00 KST (00:00 UTC)
// - 대상: 구독 중이고 watched_addresses 있는 유저
// - 발송: Resend API
// - 보안: CRON_SECRET 헤더 검증
// ────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? '';
const CRON_SECRET   = process.env.CRON_SECRET ?? '';
const FROM_EMAIL    = 'noreply@moveiq.vercel.app';
const FROM_NAME     = '무브IQ';

// ── 이메일 HTML 템플릿 ────────────────────────────────────
function buildEmailHtml(params: {
  nickname:    string;
  address:     string;
  reportCount: number;
  topNoises:   { type: string; label: string; count: number }[];
  weekOf:      string;
}): string {
  const { nickname, address, reportCount, topNoises, weekOf } = params;

  const noiseRows = topNoises.length > 0
    ? topNoises.map(n =>
        `<tr>
          <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;">${n.label}</td>
          <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:700;color:#646F4B;">${n.count}건</td>
        </tr>`
      ).join('')
    : `<tr><td colspan="2" style="padding:16px;text-align:center;color:#999;font-size:13px;">이번 주 제보 없음 — 조용한 한 주였네요 🤫</td></tr>`;

  return `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>무브IQ 주간 소음 리포트</title>
</head>
<body style="margin:0;padding:0;background:#f8faf6;font-family:'Apple SD Gothic Neo','Noto Sans KR',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8faf6;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.07);">

          <!-- 헤더 -->
          <tr>
            <td style="background:linear-gradient(135deg,#646F4B,#4a5236);padding:32px 40px;">
              <div style="font-size:22px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">🏙️ 무브IQ</div>
              <div style="font-size:13px;color:rgba(255,255,255,.7);margin-top:4px;">주간 소음 리포트 · ${weekOf}</div>
            </td>
          </tr>

          <!-- 인사 -->
          <tr>
            <td style="padding:32px 40px 0;">
              <p style="font-size:16px;color:#1a1e15;line-height:1.7;margin:0;">
                안녕하세요, <strong>${nickname}</strong>님 👋<br/>
                <strong>${address}</strong> 지역의 이번 주 소음 현황을 요약해드립니다.
              </p>
            </td>
          </tr>

          <!-- 총 제보 수 -->
          <tr>
            <td style="padding:24px 40px 0;">
              <div style="background:#f5f7f3;border-radius:12px;padding:20px 24px;display:flex;align-items:center;gap:16px;">
                <div style="font-size:36px;">🔊</div>
                <div>
                  <div style="font-size:28px;font-weight:900;color:#646F4B;">${reportCount}건</div>
                  <div style="font-size:13px;color:#7a8570;margin-top:2px;">이번 주 소음 제보</div>
                </div>
              </div>
            </td>
          </tr>

          <!-- 소음 유형 표 -->
          <tr>
            <td style="padding:24px 40px 0;">
              <div style="font-size:14px;font-weight:700;color:#111;margin-bottom:12px;">유형별 현황</div>
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8ebe3;border-radius:10px;overflow:hidden;">
                <thead>
                  <tr style="background:#f5f7f3;">
                    <th style="padding:10px 16px;text-align:left;font-size:12px;color:#7a8570;font-weight:700;">소음 유형</th>
                    <th style="padding:10px 16px;text-align:right;font-size:12px;color:#7a8570;font-weight:700;">제보 수</th>
                  </tr>
                </thead>
                <tbody>${noiseRows}</tbody>
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:28px 40px;">
              <a href="https://moveiq.vercel.app/noise-map" style="display:block;background:#646F4B;color:#ffffff;text-align:center;padding:14px 24px;border-radius:10px;font-size:15px;font-weight:700;text-decoration:none;letter-spacing:-0.3px;">
                🗺️ 소음 지도 전체 보기
              </a>
            </td>
          </tr>

          <!-- 푸터 -->
          <tr>
            <td style="background:#f5f7f3;padding:24px 40px;border-top:1px solid #e8ebe3;">
              <p style="font-size:12px;color:#aaa;margin:0;line-height:1.6;">
                이 메일은 무브IQ 프리미엄 구독자에게 발송됩니다.<br/>
                수신 거부는 <a href="https://moveiq.vercel.app/mypage" style="color:#646F4B;">마이페이지 &gt; 알림 설정</a>에서 변경할 수 있습니다.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── 소음 유형 한국어 레이블 ───────────────────────────────
const NOISE_LABELS: Record<string, string> = {
  construction:  '🏗️ 공사 소음',
  entertainment: '🎵 유흥 소음',
  floor:         '🏠 층간 소음',
  traffic:       '🚗 교통 소음',
  other:         '🐕 기타 소음',
};

// ── Cron Handler ─────────────────────────────────────────
export async function GET(req: NextRequest) {
  // Cron 보안: CRON_SECRET 검증 (Vercel Cron은 Authorization 헤더로 전달)
  const authHeader = req.headers.get('authorization');
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!RESEND_API_KEY) {
    return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 });
  }

  const supabase = createServiceClient();

  // 이번 주 월요일 ~ 오늘 범위
  const now       = new Date();
  const weekAgo   = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const weekOfStr = `${weekAgo.getFullYear()}.${String(weekAgo.getMonth() + 1).padStart(2, '0')}.${String(weekAgo.getDate()).padStart(2, '0')} ~ ${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;

  // 프리미엄 구독자 목록 조회 (plan = 'premium')
  const { data: users, error: userError } = await supabase
    .from('user_profiles')
    .select('user_id, email, nickname, plan')
    .eq('plan', 'premium');

  if (userError || !users?.length) {
    return NextResponse.json({ sent: 0, message: '대상 유저 없음' });
  }

  let sentCount = 0;
  const errors: string[] = [];

  for (const u of users) {
    try {
      // 해당 유저의 관심 주소 조회
      const { data: prefs } = await supabase
        .from('user_preferences')
        .select('watched_addresses')
        .eq('user_id', u.user_id)
        .single();

      const addresses: { address: string; lat: number; lng: number }[] =
        prefs?.watched_addresses ?? [];

      if (!addresses.length) continue;

      // 첫 번째 관심 주소 기준으로 리포트 생성 (향후 주소별 분리 가능)
      const target = addresses[0];
      const delta  = 0.018; // 약 2km

      // 지난 7일 소음 제보 집계
      const { data: reports } = await supabase
        .from('noise_reports_public_view')
        .select('noise_type')
        .gte('created_at', weekAgo.toISOString())
        .gte('lat', target.lat - delta)
        .lte('lat', target.lat + delta)
        .gte('lng', target.lng - delta)
        .lte('lng', target.lng + delta);

      const reportCount = reports?.length ?? 0;

      // 유형별 집계
      const typeCounts: Record<string, number> = {};
      reports?.forEach(r => { typeCounts[r.noise_type] = (typeCounts[r.noise_type] ?? 0) + 1; });
      const topNoises = Object.entries(typeCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 4)
        .map(([type, count]) => ({ type, label: NOISE_LABELS[type] ?? type, count }));

      // 이메일 발송 (Resend)
      const html = buildEmailHtml({
        nickname:    u.nickname ?? '회원',
        address:     target.address,
        reportCount,
        topNoises,
        weekOf:      weekOfStr,
      });

      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from:    `${FROM_NAME} <${FROM_EMAIL}>`,
          to:      [u.email],
          subject: `[무브IQ] ${target.address} 이번 주 소음 현황 — ${reportCount}건 제보됨`,
          html,
        }),
      });

      if (resendRes.ok) {
        sentCount++;
      } else {
        const errBody = await resendRes.text();
        errors.push(`${u.email}: ${errBody}`);
      }
    } catch (err) {
      errors.push(`${u.user_id}: ${String(err)}`);
    }
  }

  return NextResponse.json({
    success: true,
    sent:    sentCount,
    total:   users.length,
    errors:  errors.length > 0 ? errors : undefined,
  });
}
