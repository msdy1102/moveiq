// app/api/auth/delete-account/route.ts — 계정 탈퇴
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { apiError } from '@/lib/error-handler';

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) return apiError('UNAUTHORIZED', 401);

  try {
    // 토큰으로 사용자 확인
    const userClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const { data: { user }, error: authErr } = await userClient.auth.getUser(token);
    if (authErr || !user) return apiError('UNAUTHORIZED', 401);

    // service_role로 계정 삭제
    const admin = createServiceClient();
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) return apiError('DELETE_FAILED', 500, error);

    return NextResponse.json({ success: true });
  } catch (err) {
    return apiError('INTERNAL_ERROR', 500, err);
  }
}
