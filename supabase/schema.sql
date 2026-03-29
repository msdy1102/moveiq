-- ────────────────────────────────────────────────────────────
-- MoveIQ Supabase Schema
-- Supabase Dashboard → SQL Editor 에 붙여넣어 실행하세요.
-- ────────────────────────────────────────────────────────────

-- ── 확장 기능 활성화 ──────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS postgis; -- 지리 쿼리용

-- ── 소음 제보 테이블 ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS noise_reports (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  noise_type  TEXT NOT NULL CHECK (noise_type IN ('construction','entertainment','floor','traffic','other')),
  time_slot   TEXT NOT NULL CHECK (time_slot  IN ('dawn','morning','afternoon','evening','night')),
  severity    INT  NOT NULL CHECK (severity BETWEEN 1 AND 5),
  lat         DOUBLE PRECISION NOT NULL,
  lng         DOUBLE PRECISION NOT NULL,
  description TEXT,
  reporter_ip TEXT,       -- 어뷰징 감지용
  reporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 위치 인덱스 (지리 쿼리 최적화)
CREATE INDEX IF NOT EXISTS idx_noise_reports_location ON noise_reports(lat, lng);
CREATE INDEX IF NOT EXISTS idx_noise_reports_type     ON noise_reports(noise_type);
CREATE INDEX IF NOT EXISTS idx_noise_reports_created  ON noise_reports(created_at DESC);

-- RLS 활성화
ALTER TABLE noise_reports ENABLE ROW LEVEL SECURITY;

-- 누구나 제보 가능 (INSERT)
CREATE POLICY "noise_reports_insert"
  ON noise_reports FOR INSERT WITH CHECK (true);

-- 공개 SELECT — 아래 뷰를 통해서만 노출
CREATE POLICY "noise_reports_select_own"
  ON noise_reports FOR SELECT
  USING (reporter_id = auth.uid());

-- 본인 제보만 삭제
CREATE POLICY "noise_reports_delete_own"
  ON noise_reports FOR DELETE
  USING (reporter_id = auth.uid());

-- 공개 뷰: 위치 50m 랜덤화 (개인정보 보호)
CREATE OR REPLACE VIEW noise_reports_public_view AS
SELECT
  id,
  noise_type,
  time_slot,
  severity,
  lat  + (random() - 0.5) * 0.0009 AS lat,
  lng  + (random() - 0.5) * 0.0009 AS lng,
  created_at
FROM noise_reports;

-- ── 입지 분석 캐시 ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS analysis_cache (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  address    TEXT NOT NULL UNIQUE,
  result     JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cache_address ON analysis_cache(address);
CREATE INDEX IF NOT EXISTS idx_cache_created ON analysis_cache(created_at DESC);

-- 캐시는 서버만 읽기/쓰기 (service_role 전용)
ALTER TABLE analysis_cache ENABLE ROW LEVEL SECURITY;
-- 정책 없음 = anon/authenticated 접근 차단, service_role만 허용

-- ── 결제 테이블 ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id    TEXT NOT NULL UNIQUE,
  payment_key TEXT NOT NULL,
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  plan_code   TEXT NOT NULL,
  amount      INT  NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending',
  toss_data   JSONB,
  paid_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- 본인 결제만 조회
CREATE POLICY "payments_select_own"
  ON payments FOR SELECT
  USING (user_id = auth.uid());

-- INSERT/UPDATE/DELETE: service_role 전용 (정책 없음 = 클라이언트 차단)

-- ── 어드민 감사 로그 (삭제 불가) ────────────────────────
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id   UUID NOT NULL,
  action     TEXT NOT NULL,
  target_id  TEXT,
  ip         TEXT,
  detail     JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;
-- 정책 없음: service_role만 INSERT 가능, 어드민도 삭제 불가
-- 별도 로그 DB 분리 권장 (프로덕션)

-- ── 사용자 환경설정 (검색 히스토리 + 관심 동네) ─────────
-- session_id: 비로그인 익명 UUID (localStorage), 로그인 후 user_id와 연결
CREATE TABLE IF NOT EXISTS user_preferences (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id    TEXT NOT NULL,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  search_history JSONB NOT NULL DEFAULT '[]',   -- 입지 분석 검색 히스토리
  community_dongs JSONB NOT NULL DEFAULT '[]',  -- 커뮤니티 관심 동네
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_prefs_session ON user_preferences(session_id);
CREATE INDEX IF NOT EXISTS idx_user_prefs_user ON user_preferences(user_id);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- session_id 기반 자신의 데이터만 읽기/쓰기
CREATE POLICY "user_prefs_select"
  ON user_preferences FOR SELECT
  USING (session_id = current_setting('app.session_id', true));

CREATE POLICY "user_prefs_insert"
  ON user_preferences FOR INSERT
  WITH CHECK (session_id = current_setting('app.session_id', true));

CREATE POLICY "user_prefs_update"
  ON user_preferences FOR UPDATE
  USING (session_id = current_setting('app.session_id', true));

-- ── 자동 정리: 90일 이상 된 캐시 삭제 (선택) ──────────
-- Supabase pg_cron 활성화 후 사용
-- SELECT cron.schedule('cleanup-cache', '0 3 * * *', $$
--   DELETE FROM analysis_cache WHERE created_at < NOW() - INTERVAL '90 days';
-- $$);

-- ── 인증 후 user_id와 session 연결 (로그인 시 자동 마이그레이션) ──
-- 로그인 후 session_id → user_id 연결 trigger (선택 구현)
-- UPDATE user_preferences SET user_id = auth.uid()
--   WHERE session_id = 'client-session-id' AND user_id IS NULL;
