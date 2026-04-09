// app/api/admin/audit-log/route.ts
// 감사 로그 조회 (읽기 전용 — 삭제/수정 불가)
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin }        from '@/lib/admin-auth';
import { apiError }           from '@/lib/error-handler';
import { createServiceClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (admin instanceof Response) return admin;

  const limit  = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? 50), 200);
  const action = req.nextUrl.searchParams.get('action') ?? '';

  try {
    const sb = createServiceClient();

    let query = sb
      .from('admin_audit_log')
      .select('id, admin_id, action, target_id, detail, ip, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (action) query = query.eq('action', action);

    const { data, error } = await query;
    if (error) return apiError('INTERNAL_ERROR', 500, error);

    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (err) {
    return apiError('INTERNAL_ERROR', 500, err);
  }
}
