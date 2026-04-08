-- ─────────────────────────────────────────────────────────────
-- MoveIQ Migration v4
-- 1. noise_reports: report_count, is_blinded 컬럼 추가
-- 2. community_posts: report_count, is_blinded 컬럼 추가
-- 3. community_comments: report_count, is_blinded 컬럼 추가
-- 4. noise_report_flags: 신고 추적 테이블 (중복 방지)
-- 5. community_report_flags: 게시글/댓글 신고 추적 테이블
-- 6. admin_report_queue: 어드민 검토 큐
-- 실행 위치: Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────

-- ══════════════════════════════════════════════════════════════
-- 1. noise_reports 컬럼 추가
-- ══════════════════════════════════════════════════════════════
ALTER TABLE noise_reports
  ADD COLUMN IF NOT EXISTS report_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_blinded   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS photo_url    TEXT;

-- 공개 뷰에서 블라인드 처리된 제보 숨기기
CREATE OR REPLACE VIEW noise_reports_public_view AS
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

-- ══════════════════════════════════════════════════════════════
-- 2. community_posts 컬럼 추가
-- ══════════════════════════════════════════════════════════════
ALTER TABLE community_posts
  ADD COLUMN IF NOT EXISTS report_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_blinded   BOOLEAN NOT NULL DEFAULT FALSE;

-- ══════════════════════════════════════════════════════════════
-- 3. community_comments 컬럼 추가
-- ══════════════════════════════════════════════════════════════
ALTER TABLE community_comments
  ADD COLUMN IF NOT EXISTS report_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_blinded   BOOLEAN NOT NULL DEFAULT FALSE;

-- ══════════════════════════════════════════════════════════════
-- 4. noise_report_flags — 소음 제보 신고 추적
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS noise_report_flags (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  noise_report_id UUID NOT NULL REFERENCES noise_reports(id) ON DELETE CASCADE,
  reporter_ip    TEXT NOT NULL,
  reporter_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason         TEXT NOT NULL CHECK (reason IN ('fake', 'spam', 'inappropriate', 'duplicate', 'other')),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  -- 동일 IP + 동일 제보 중복 신고 방지
  UNIQUE(noise_report_id, reporter_ip)
);

CREATE INDEX IF NOT EXISTS idx_noise_flags_report ON noise_report_flags(noise_report_id);
CREATE INDEX IF NOT EXISTS idx_noise_flags_ip     ON noise_report_flags(reporter_ip);

ALTER TABLE noise_report_flags ENABLE ROW LEVEL SECURITY;
-- service_role 전용 접근
CREATE POLICY "noise_flags_service_only"
  ON noise_report_flags FOR ALL
  USING (false) WITH CHECK (false);

-- ══════════════════════════════════════════════════════════════
-- 5. community_report_flags — 게시글/댓글 신고 추적
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS community_report_flags (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  target_type  TEXT NOT NULL CHECK (target_type IN ('post', 'comment')),
  target_id    UUID NOT NULL,
  reporter_ip  TEXT NOT NULL,
  reporter_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason       TEXT NOT NULL CHECK (reason IN ('fake', 'spam', 'inappropriate', 'defamation', 'duplicate', 'other')),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  -- 동일 대상 중복 신고 방지 (IP 기준)
  UNIQUE(target_type, target_id, reporter_ip)
);

CREATE INDEX IF NOT EXISTS idx_comm_flags_target ON community_report_flags(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_comm_flags_ip     ON community_report_flags(reporter_ip);

ALTER TABLE community_report_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comm_flags_service_only"
  ON community_report_flags FOR ALL
  USING (false) WITH CHECK (false);

-- ══════════════════════════════════════════════════════════════
-- 6. admin_report_queue — 어드민 검토 큐 (블라인드 처리 이력)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS admin_report_queue (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  target_type   TEXT NOT NULL CHECK (target_type IN ('noise_report', 'community_post', 'community_comment')),
  target_id     UUID NOT NULL,
  report_count  INT  NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'reviewed_keep', 'reviewed_remove', 'auto_blinded')),
  admin_note    TEXT,
  reviewed_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_queue_status  ON admin_report_queue(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_queue_target  ON admin_report_queue(target_type, target_id);

ALTER TABLE admin_report_queue ENABLE ROW LEVEL SECURITY;
-- 어드민 어드잇 로그와 동일 — INSERT 전용, 삭제 불가
CREATE POLICY "queue_insert_only"
  ON admin_report_queue FOR INSERT WITH CHECK (true);
CREATE POLICY "queue_select_service"
  ON admin_report_queue FOR SELECT USING (false);

-- ══════════════════════════════════════════════════════════════
-- 7. 자동 블라인드 함수 — noise_report_flags 신규 삽입 시 트리거
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION auto_blind_noise_report()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_count INT;
BEGIN
  -- 신고 누적 카운트 업데이트
  UPDATE noise_reports
    SET report_count = report_count + 1
    WHERE id = NEW.noise_report_id
    RETURNING report_count INTO v_count;

  -- 3건 이상 → 자동 블라인드
  IF v_count >= 3 THEN
    UPDATE noise_reports SET is_blinded = TRUE WHERE id = NEW.noise_report_id;
    -- 어드민 큐에 등록 (중복 방지: 이미 있으면 count만 업데이트)
    INSERT INTO admin_report_queue(target_type, target_id, report_count, status)
      VALUES('noise_report', NEW.noise_report_id, v_count, 'auto_blinded')
      ON CONFLICT DO NOTHING;
  ELSE
    -- 첫 신고 시 큐에 등록
    INSERT INTO admin_report_queue(target_type, target_id, report_count, status)
      VALUES('noise_report', NEW.noise_report_id, v_count, 'pending')
      ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_blind_noise_report ON noise_report_flags;
CREATE TRIGGER trg_blind_noise_report
  AFTER INSERT ON noise_report_flags
  FOR EACH ROW EXECUTE FUNCTION auto_blind_noise_report();

-- ══════════════════════════════════════════════════════════════
-- 8. 자동 블라인드 함수 — community_report_flags 신규 삽입 시
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION auto_blind_community_content()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_count INT;
BEGIN
  IF NEW.target_type = 'post' THEN
    UPDATE community_posts
      SET report_count = report_count + 1
      WHERE id = NEW.target_id
      RETURNING report_count INTO v_count;
    IF v_count >= 3 THEN
      UPDATE community_posts SET is_blinded = TRUE WHERE id = NEW.target_id;
      INSERT INTO admin_report_queue(target_type, target_id, report_count, status)
        VALUES('community_post', NEW.target_id, v_count, 'auto_blinded')
        ON CONFLICT DO NOTHING;
    ELSE
      INSERT INTO admin_report_queue(target_type, target_id, report_count, status)
        VALUES('community_post', NEW.target_id, v_count, 'pending')
        ON CONFLICT DO NOTHING;
    END IF;

  ELSIF NEW.target_type = 'comment' THEN
    UPDATE community_comments
      SET report_count = report_count + 1
      WHERE id = NEW.target_id
      RETURNING report_count INTO v_count;
    IF v_count >= 3 THEN
      UPDATE community_comments SET is_blinded = TRUE WHERE id = NEW.target_id;
      INSERT INTO admin_report_queue(target_type, target_id, report_count, status)
        VALUES('community_comment', NEW.target_id, v_count, 'auto_blinded')
        ON CONFLICT DO NOTHING;
    ELSE
      INSERT INTO admin_report_queue(target_type, target_id, report_count, status)
        VALUES('community_comment', NEW.target_id, v_count, 'pending')
        ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_blind_community ON community_report_flags;
CREATE TRIGGER trg_blind_community
  AFTER INSERT ON community_report_flags
  FOR EACH ROW EXECUTE FUNCTION auto_blind_community_content();

-- ══════════════════════════════════════════════════════════════
-- 완료 확인
-- ══════════════════════════════════════════════════════════════
SELECT 'Migration v4 완료' AS status;
