-- ─────────────────────────────────────────────────────────────
-- MoveIQ Security Patch — noise_reports_public_view
-- Security Advisor 오류 해결:
--   "Security Definer View" — SECURITY INVOKER로 재생성
--
-- 적용 대상:
--   migration_v4.sql을 이미 실행한 경우 이 파일만 실행
--   아직 실행 안 한 경우 migration_v4_fixed.sql(최신)만 실행
--
-- 실행 위치: Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────

-- 1. 기존 뷰 삭제
DROP VIEW IF EXISTS noise_reports_public_view;

-- 2. SECURITY INVOKER로 재생성
--    → 쿼리하는 유저의 RLS 정책이 적용됨 (보안 강화)
--    → 뷰 생성자(postgres) 권한으로 실행되지 않음
CREATE VIEW noise_reports_public_view
  WITH (security_invoker = true)
AS
SELECT
  id,
  noise_type,
  time_slot,
  severity,
  -- 위치 50m 랜덤화 (개인정보 보호)
  lat + (random() - 0.5) * 0.0009 AS lat,
  lng + (random() - 0.5) * 0.0009 AS lng,
  description,
  photo_url,
  created_at
FROM noise_reports
WHERE is_blinded = FALSE;

-- 3. 확인
SELECT 'Security patch 완료 — SECURITY INVOKER 적용됨' AS status;
