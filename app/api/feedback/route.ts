import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { type, text, email } = await req.json();
    if (!type || !text) {
      return NextResponse.json({ success: false, message: '유형과 내용을 입력해주세요.' }, { status: 400 });
    }

    // Resend API가 설정된 경우 이메일 발송
    const RESEND_KEY = process.env.RESEND_API_KEY;
    if (RESEND_KEY) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_KEY}` },
        body: JSON.stringify({
          from: 'noreply@moveiq.co.kr',
          to: ['admin@moveiq.co.kr'],
          subject: `[무브IQ 불편사항] ${type}`,
          text: `유형: ${type}\n\n내용:\n${text}\n\n${email ? `연락처: ${email}` : '연락처 없음'}`,
        }),
      });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
