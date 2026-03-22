// lib/supabase.ts
// ────────────────────────────────────────────────────────────
// 빌드 시점이 아닌 런타임(함수 호출 시점)에 클라이언트를 생성합니다.
// 모듈 상단에서 즉시 createClient() 하면 Vercel 빌드 시
// 환경변수가 없어 "supabaseUrl is required" 에러가 납니다.
// ────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js';

// 브라우저/서버 공용 — anon 키 + RLS 적용 (lazy singleton)
let _client: ReturnType<typeof createClient> | null = null;

export function getSupabase() {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    if (!url || !key) throw new Error('Supabase 환경변수(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)가 설정되지 않았습니다.');
    _client = createClient(url, key);
  }
  return _client;
}

// 하위 호환성 (기존 import { supabase } 사용 코드 대응)
export const supabase = {
  from: (...args: Parameters<ReturnType<typeof createClient>['from']>) =>
    getSupabase().from(...args),
};

// 서버 전용 — service_role 키 (RLS 우회, 절대 클라이언트 노출 금지)
export function createServiceClient() {
  const url        = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('Supabase 서버 환경변수(SUPABASE_SERVICE_ROLE_KEY)가 설정되지 않았습니다.');
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}

