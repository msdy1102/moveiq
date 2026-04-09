-- ─────────────────────────────────────────────────────────────
-- MoveIQ Migration v5 — 어드민 대시보드 지원
-- 어드민 통계에서 analysis_history 테이블을 사용하므로
-- 해당 테이블이 없는 경우 아래 SQL을 실행하세요.
-- 이미 존재하는 경우 IF NOT EXISTS로 안전하게 건너뜁니다.
-- 실행 위치: Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────

-- ── analysis_history (이미 schema.sql에 있으나 혹시 누락된 경우 대비) ──
CREATE TABLE IF NOT EXISTS analysis_history (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id  TEXT,
  address     TEXT NOT NULL,
  result      JSONB NOT NULL,
  total_score INT,
  grade       TEXT,
  cached      BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analysis_history_user    ON analysis_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analysis_history_session ON analysis_history(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analysis_history_date    ON analysis_history(created_at DESC);

ALTER TABLE analysis_history ENABLE ROW LEVEL SECURITY;

-- 자신의 히스토리만 조회
CREATE POLICY IF NOT EXISTS "history_select_own"
  ON analysis_history FOR SELECT
  USING (user_id = auth.uid() OR session_id IS NOT NULL);

-- ── admin_audit_log: admin_id 컬럼 타입 확인 (TEXT로 변경 허용) ──
-- profiles.id는 UUID이지만 admin_audit_log.admin_id는 TEXT로 저장
-- (NextAuth 호환성 또는 서비스 계정 ID 포함 고려)
-- 이미 UUID 타입인 경우 아래 줄은 건너뛰세요.
-- ALTER TABLE admin_audit_log ALTER COLUMN admin_id TYPE TEXT;

SELECT 'Migration v5 완료' AS status;
