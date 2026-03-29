-- ────────────────────────────────────────────────────────────
-- MoveIQ — 안전한 스키마 업데이트 (이미 존재하는 DB에 실행)
-- 기존 테이블/정책이 있어도 에러 없이 실행됩니다.
-- ────────────────────────────────────────────────────────────

-- ── 확장 기능 ────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── user_preferences 테이블만 새로 추가 ──────────────────────
-- (noise_reports, analysis_cache, payments는 이미 존재 → 건너뜀)
CREATE TABLE IF NOT EXISTS user_preferences (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id       TEXT NOT NULL,
  user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  search_history   JSONB NOT NULL DEFAULT '[]',
  community_dongs  JSONB NOT NULL DEFAULT '[]',
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_prefs_session ON user_preferences(session_id);
CREATE INDEX IF NOT EXISTS idx_user_prefs_user ON user_preferences(user_id);

-- RLS 활성화 (이미 활성화돼 있어도 에러 없음)
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- 정책 — 존재하면 삭제 후 재생성
DROP POLICY IF EXISTS "user_prefs_select" ON user_preferences;
DROP POLICY IF EXISTS "user_prefs_insert" ON user_preferences;
DROP POLICY IF EXISTS "user_prefs_update" ON user_preferences;

-- service_role만 접근 (서버 API Route에서 service_role 키로 호출)
-- 클라이언트는 API Route를 통해서만 읽기/쓰기 가능
-- (RLS 정책 없음 = anon/authenticated 차단, service_role만 허용)

-- ── 기존 noise_reports 정책 안전하게 재생성 ──────────────────
-- (이미 있으면 DROP 후 재생성하여 에러 방지)
DROP POLICY IF EXISTS "noise_reports_insert"      ON noise_reports;
DROP POLICY IF EXISTS "noise_reports_select_own"  ON noise_reports;
DROP POLICY IF EXISTS "noise_reports_delete_own"  ON noise_reports;

CREATE POLICY "noise_reports_insert"
  ON noise_reports FOR INSERT WITH CHECK (true);

CREATE POLICY "noise_reports_select_own"
  ON noise_reports FOR SELECT
  USING (reporter_id = auth.uid());

CREATE POLICY "noise_reports_delete_own"
  ON noise_reports FOR DELETE
  USING (reporter_id = auth.uid());

-- ── noise_reports_public_view 재생성 ─────────────────────────
CREATE OR REPLACE VIEW noise_reports_public_view AS
SELECT
  id, noise_type, time_slot, severity,
  lat + (random() - 0.5) * 0.0009 AS lat,
  lng + (random() - 0.5) * 0.0009 AS lng,
  created_at
FROM noise_reports;

-- ── 완료 확인용 ──────────────────────────────────────────────
SELECT 'Schema updated successfully' AS result;
