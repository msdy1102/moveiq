// lib/admin-auth.ts
// 어드민 전용 인증 유틸
// - Bearer 토큰 → Supabase user 검증
// - ADMIN_EMAIL 환경변수와 일치 여부 확인
// - 모든 어드민 액션을 admin_audit_log에 기록
// ────────────────────────────────────────────────────────────

import { NextRequest } from 'next/server';
import { createClient }       from '@supabase/supabase-js';
import { createServiceClient } from './supabase';
import { apiError }            from './error-handler';

// ── 어드민 이메일 환경변수 ───────────────────────────────────
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? '';

export interface AdminUser {
  id:    string;
  email: string;
}

/**
 * 요청의 Authorization 헤더를 검증하고 어드민 유저를 반환합니다.
 * 실패 시 apiError Response를 반환합니다.
 */
export async function verifyAdmin(
  req: NextRequest,
): Promise<AdminUser | Response> {
  // 환경변수 미설정 시 서버 오류
  if (!ADMIN_EMAIL) {
    console.error('[ADMIN] ADMIN_EMAIL 환경변수가 설정되지 않았습니다.');
    return apiError('CONFIG_ERROR', 500);
  }

  // Bearer 토큰 추출
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return apiError('UNAUTHORIZED', 401);

  try {
    // 토큰으로 Supabase 유저 확인
    const anonClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const { data: { user }, error } = await anonClient.auth.getUser(token);
    if (error || !user) return apiError('UNAUTHORIZED', 401);

    // 어드민 이메일 일치 여부 확인
    if (user.email !== ADMIN_EMAIL) {
      // 404 반환 — 어드민 존재 자체를 숨김
      return apiError('NOT_FOUND', 404);
    }

    return { id: user.id, email: user.email };
  } catch {
    return apiError('UNAUTHORIZED', 401);
  }
}

/**
 * 어드민 액션을 audit log에 기록합니다 (삭제 불가).
 */
export async function logAdminAction(opts: {
  adminId:  string;
  action:   string;
  targetId?: string;
  detail?:  Record<string, unknown>;
  ip:       string;
}) {
  try {
    const sb = createServiceClient();
    await sb.from('admin_audit_log').insert({
      admin_id:  opts.adminId,
      action:    opts.action,
      target_id: opts.targetId ?? null,
      detail:    opts.detail   ?? null,
      ip:        opts.ip,
    });
  } catch (err) {
    // 로그 실패는 조용히 처리 (메인 작업 차단 방지)
    console.error('[ADMIN AUDIT] 로그 기록 실패:', err);
  }
}
