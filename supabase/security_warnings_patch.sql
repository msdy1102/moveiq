-- ─────────────────────────────────────────────────────────────
-- MoveIQ Security Warnings Patch
-- Supabase Security Advisor Warnings 해결
--
-- 해결 항목:
--   1. Function Search Path Mutable — auto_blind_noise_report
--   2. Function Search Path Mutable — auto_blind_community_content
--   3. RLS Policy Always True       — admin_report_queue queue_insert_only
--
-- 미해결 항목 (대시보드 수동 설정 필요):
--   4. Leaked Password Protection Disabled
--      → Supabase 대시보드 > Authentication > Settings
--        > "Leaked Password Protection" 토글 ON
--
-- 실행 위치: Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────


-- ══════════════════════════════════════════════════════════════
-- 1 & 2. Function Search Path Mutable 해결
-- 원인: search_path가 고정되지 않으면 악의적인 스키마 인젝션으로
--       함수가 의도치 않은 테이블/함수를 참조할 수 있음
-- 해결: SET search_path = '' 추가 + 모든 테이블을 schema prefix로 명시
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.auto_blind_noise_report()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''          -- ← 핵심 수정: 빈 search_path 고정
AS $$
DECLARE
  v_count INT;
BEGIN
  -- 신고 누적 카운트 업데이트 (schema prefix 필수)
  UPDATE public.noise_reports
    SET report_count = report_count + 1
    WHERE id = NEW.noise_report_id
    RETURNING report_count INTO v_count;

  IF v_count >= 3 THEN
    -- 3건 이상 → 자동 블라인드
    UPDATE public.noise_reports
      SET is_blinded = TRUE
      WHERE id = NEW.noise_report_id;

    INSERT INTO public.admin_report_queue(target_type, target_id, report_count, status)
      VALUES('noise_report', NEW.noise_report_id, v_count, 'auto_blinded')
      ON CONFLICT (target_type, target_id)
      DO UPDATE SET report_count = EXCLUDED.report_count, status = 'auto_blinded',
                    updated_at = NOW();
  ELSE
    INSERT INTO public.admin_report_queue(target_type, target_id, report_count, status)
      VALUES('noise_report', NEW.noise_report_id, v_count, 'pending')
      ON CONFLICT (target_type, target_id)
      DO UPDATE SET report_count = EXCLUDED.report_count,
                    updated_at = NOW();
  END IF;

  RETURN NEW;
END;
$$;


CREATE OR REPLACE FUNCTION public.auto_blind_community_content()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''          -- ← 핵심 수정: 빈 search_path 고정
AS $$
DECLARE
  v_count INT;
BEGIN
  IF NEW.target_type = 'post' THEN
    UPDATE public.community_posts
      SET report_count = report_count + 1
      WHERE id = NEW.target_id
      RETURNING report_count INTO v_count;

    IF v_count >= 3 THEN
      UPDATE public.community_posts SET is_blinded = TRUE WHERE id = NEW.target_id;
      INSERT INTO public.admin_report_queue(target_type, target_id, report_count, status)
        VALUES('community_post', NEW.target_id, v_count, 'auto_blinded')
        ON CONFLICT (target_type, target_id)
        DO UPDATE SET report_count = EXCLUDED.report_count, status = 'auto_blinded',
                      updated_at = NOW();
    ELSE
      INSERT INTO public.admin_report_queue(target_type, target_id, report_count, status)
        VALUES('community_post', NEW.target_id, v_count, 'pending')
        ON CONFLICT (target_type, target_id)
        DO UPDATE SET report_count = EXCLUDED.report_count,
                      updated_at = NOW();
    END IF;

  ELSIF NEW.target_type = 'comment' THEN
    UPDATE public.community_comments
      SET report_count = report_count + 1
      WHERE id = NEW.target_id
      RETURNING report_count INTO v_count;

    IF v_count >= 3 THEN
      UPDATE public.community_comments SET is_blinded = TRUE WHERE id = NEW.target_id;
      INSERT INTO public.admin_report_queue(target_type, target_id, report_count, status)
        VALUES('community_comment', NEW.target_id, v_count, 'auto_blinded')
        ON CONFLICT (target_type, target_id)
        DO UPDATE SET report_count = EXCLUDED.report_count, status = 'auto_blinded',
                      updated_at = NOW();
    ELSE
      INSERT INTO public.admin_report_queue(target_type, target_id, report_count, status)
        VALUES('community_comment', NEW.target_id, v_count, 'pending')
        ON CONFLICT (target_type, target_id)
        DO UPDATE SET report_count = EXCLUDED.report_count,
                      updated_at = NOW();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


-- ══════════════════════════════════════════════════════════════
-- 3. RLS Policy Always True 해결 — admin_report_queue
-- 원인: WITH CHECK (true) 는 모든 INSERT를 무조건 허용 → 너무 허용적
-- 해결: service_role 또는 트리거 컨텍스트에서만 INSERT 허용
--       실제로 이 테이블은 트리거 함수(SECURITY DEFINER)에서만
--       INSERT 되므로 anon/authenticated 직접 접근을 차단
-- ══════════════════════════════════════════════════════════════

-- 기존 허용적 정책 제거
DROP POLICY IF EXISTS "queue_insert_only"   ON public.admin_report_queue;
DROP POLICY IF EXISTS "queue_select_service" ON public.admin_report_queue;

-- SELECT: 완전 차단 (service_role은 RLS 우회하므로 별도 정책 불필요)
-- INSERT: anon/authenticated 직접 접근 차단
--         트리거 함수는 SECURITY DEFINER로 실행되므로 RLS 우회됨
CREATE POLICY "queue_no_direct_access"
  ON public.admin_report_queue
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- ══════════════════════════════════════════════════════════════
-- 4. Leaked Password Protection — 대시보드에서 수동 설정 필요
-- SQL로 변경 불가 → 아래 경로에서 직접 활성화:
--   Supabase 대시보드 → Authentication → Settings
--   → "Leaked Password Protection" 토글 ON
-- ══════════════════════════════════════════════════════════════


-- ══════════════════════════════════════════════════════════════
-- 완료 확인
-- ══════════════════════════════════════════════════════════════
SELECT 'Security warnings patch 완료' AS status;
