// lib/supabase.ts
// ────────────────────────────────────────────────────────────
// 클라이언트용(anon key)과 서버용(service_role key)을 분리합니다.
// service_role 키는 절대 브라우저 번들에 포함되면 안 됩니다.
// ────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// 브라우저/서버 공용 — anon 키 + RLS 적용
export const supabase = createClient(supabaseUrl, supabaseAnon);

// 서버 전용 — service_role 키 (RLS 우회 가능, 절대 클라이언트 노출 금지)
export function createServiceClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY 환경변수가 없습니다.');
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });
}
