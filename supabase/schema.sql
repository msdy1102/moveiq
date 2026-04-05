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

-- ══════════════════════════════════════════════════════════════
-- v3 추가 테이블 — 2026.04
-- ══════════════════════════════════════════════════════════════

-- ── 1. 회원 프로필 (Supabase Auth 보조 테이블) ────────────────
-- auth.users 에 없는 추가 정보 (닉네임, 가입경로, 구독 플랜 등)
CREATE TABLE IF NOT EXISTS profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname        TEXT NOT NULL DEFAULT '',
  avatar_url      TEXT,
  plan            TEXT NOT NULL DEFAULT 'free'  -- free | one_time | premium
                  CHECK (plan IN ('free','one_time','premium')),
  plan_expires_at TIMESTAMPTZ,
  analysis_count  INT  NOT NULL DEFAULT 0,      -- 누적 분석 횟수
  daily_count     INT  NOT NULL DEFAULT 0,      -- 오늘 분석 횟수 (rate limit)
  daily_reset_at  DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own"
  ON profiles FOR SELECT USING (id = auth.uid());

CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE USING (id = auth.uid());

-- INSERT는 trigger로만 (아래)

-- 신규 가입 시 profiles 자동 생성 trigger
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, nickname, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nickname', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- updated_at 자동 갱신 trigger
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 2. 입지 분석 히스토리 (유저/세션별 저장) ─────────────────
CREATE TABLE IF NOT EXISTS analysis_history (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id   TEXT,                          -- 비로그인 익명 UUID
  address      TEXT NOT NULL,
  result       JSONB NOT NULL,               -- AI 분석 전체 결과
  total_score  INT,                          -- 종합 점수 (빠른 조회용)
  grade        TEXT,                         -- 등급 (B+ 등)
  cached       BOOLEAN DEFAULT false,        -- 캐시 히트 여부
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analysis_history_user    ON analysis_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analysis_history_session ON analysis_history(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analysis_history_address ON analysis_history(address);

ALTER TABLE analysis_history ENABLE ROW LEVEL SECURITY;

-- 본인 히스토리만 조회
CREATE POLICY "analysis_history_select_own"
  ON analysis_history FOR SELECT
  USING (
    (user_id IS NOT NULL AND user_id = auth.uid())
    OR
    (user_id IS NULL AND session_id = current_setting('app.session_id', true))
  );

-- INSERT/DELETE: service_role 전용 (API Route에서만 저장)

-- ── 3. 불편사항 접수 (DB 영구 보관) ─────────────────────────
CREATE TABLE IF NOT EXISTS feedbacks (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id  TEXT,
  type        TEXT NOT NULL CHECK (type IN ('버그 신고','기능 건의','데이터 오류','기타 불편')),
  content     TEXT NOT NULL CHECK (char_length(content) <= 2000),
  email       TEXT,                          -- 답변받을 이메일 (선택)
  status      TEXT NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending','reviewing','resolved','closed')),
  admin_note  TEXT,                          -- 어드민 처리 메모
  ip          TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedbacks_status  ON feedbacks(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedbacks_user    ON feedbacks(user_id);
CREATE INDEX IF NOT EXISTS idx_feedbacks_session ON feedbacks(session_id);

ALTER TABLE feedbacks ENABLE ROW LEVEL SECURITY;

-- 본인 제출 내역 조회
CREATE POLICY "feedbacks_select_own"
  ON feedbacks FOR SELECT
  USING (
    (user_id IS NOT NULL AND user_id = auth.uid())
    OR
    (user_id IS NULL AND session_id = current_setting('app.session_id', true))
  );

-- INSERT: service_role 전용 (API Route에서만)

-- updated_at trigger
DROP TRIGGER IF EXISTS feedbacks_updated_at ON feedbacks;
CREATE TRIGGER feedbacks_updated_at
  BEFORE UPDATE ON feedbacks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ══════════════════════════════════════════════════════════════
-- user_preferences 테이블 컬럼 보강 (watched_addresses 추가)
-- ══════════════════════════════════════════════════════════════
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS watched_addresses JSONB NOT NULL DEFAULT '[]';

-- ══════════════════════════════════════════════════════════════
-- v4 커뮤니티 테이블 — 2026.04
-- ══════════════════════════════════════════════════════════════

-- ── community_posts ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS community_posts (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id  TEXT,                         -- 비로그인 임시 식별자
  nickname    TEXT NOT NULL DEFAULT '익명',
  dong        TEXT NOT NULL DEFAULT '전체', -- 행정동 (예: 성산동)
  category    TEXT NOT NULL DEFAULT '동네 질문'
              CHECK (category IN ('동네 질문','생활 꿀팁','소음 후기','이사 후기','동네 소식','이웃 구해요','건물 후기')),
  title       TEXT NOT NULL CHECK (char_length(title) BETWEEN 2 AND 100),
  content     TEXT NOT NULL CHECK (char_length(content) BETWEEN 2 AND 3000),
  likes       INT  NOT NULL DEFAULT 0,
  comments    INT  NOT NULL DEFAULT 0,      -- 댓글 수 (캐시)
  is_verified BOOLEAN NOT NULL DEFAULT FALSE, -- 주민 인증 여부
  ip          TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_posts_dong      ON community_posts(dong, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_category  ON community_posts(category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_user      ON community_posts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_created   ON community_posts(created_at DESC);

ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;

-- 누구나 읽기
CREATE POLICY "posts_select_all"
  ON community_posts FOR SELECT USING (true);

-- INSERT / UPDATE / DELETE: service_role 전용 (API Route에서만)

DROP TRIGGER IF EXISTS posts_updated_at ON community_posts;
CREATE TRIGGER posts_updated_at
  BEFORE UPDATE ON community_posts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── community_comments ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS community_comments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id     UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id  TEXT,
  nickname    TEXT NOT NULL DEFAULT '익명',
  content     TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 1000),
  likes       INT  NOT NULL DEFAULT 0,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ip          TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_post    ON community_comments(post_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_comments_user    ON community_comments(user_id);

ALTER TABLE community_comments ENABLE ROW LEVEL SECURITY;

-- 누구나 읽기
CREATE POLICY "comments_select_all"
  ON community_comments FOR SELECT USING (true);

-- INSERT / UPDATE / DELETE: service_role 전용

-- ── community_likes ───────────────────────────────────────────
-- 중복 좋아요 방지
CREATE TABLE IF NOT EXISTS community_likes (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  target_id  UUID NOT NULL,              -- post_id 또는 comment_id
  target_type TEXT NOT NULL CHECK (target_type IN ('post','comment')),
  session_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (target_id, target_type, session_id)
);

CREATE INDEX IF NOT EXISTS idx_likes_target ON community_likes(target_id, target_type);

ALTER TABLE community_likes ENABLE ROW LEVEL SECURITY;
-- 누구나 조회 (좋아요 여부 확인용)
CREATE POLICY "likes_select_all" ON community_likes FOR SELECT USING (true);
-- INSERT / DELETE: service_role 전용
