-- ========================================================
-- LIFE ARCHIVE - SUPABASE POSTGRESQL SCHEMA INITIALIZATION
-- Phiên bản: 1.3 (Final Production Release)
-- ========================================================

-- Đặt search_path cho phiên thực thi để nhận diện extensions
SET search_path TO public, extensions;

-- Kích hoạt các extension cần thiết
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "unaccent";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ========================================================
-- 1. BẢNG DỮ LIỆU GỐC RSS (READ-ONLY CHO CLIENT)
-- ========================================================
CREATE TABLE IF NOT EXISTS public.rss_episodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guid TEXT UNIQUE NOT NULL,                          -- Buzzsprout GUID (đã tự động có B-Tree index từ UNIQUE)
  title TEXT NOT NULL,                                -- vd: '17-04-2026'
  pub_date TIMESTAMPTZ NOT NULL,
  duration_seconds INTEGER NOT NULL,
  audio_url TEXT NOT NULL,                            -- Stream MP3 trực tiếp từ Buzzsprout CDN
  channel_image_url TEXT,
  extracted_sender TEXT,                              -- Tên người gửi bóc tách từ RSS
  source_doc_url TEXT,                                -- Link Google Docs (nếu có)
  raw_confession TEXT,                                -- Text gốc bóc từ RSS
  raw_description_html TEXT,                          -- HTML gốc dự phòng
  content_status VARCHAR(20) NOT NULL CHECK (
    content_status IN ('full', 'partial', 'external', 'missing')
  ),
  search_text TEXT,                                   -- Cột chuẩn hóa text tiếng Việt không dấu cho Full-Text Search
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index tăng tốc lọc theo ngày phát sóng và trạng thái nội dung
CREATE INDEX IF NOT EXISTS idx_rss_episodes_pub_date ON public.rss_episodes (pub_date DESC);
CREATE INDEX IF NOT EXISTS idx_rss_episodes_content_status ON public.rss_episodes (content_status);

-- --------------------------------------------------------
-- Trigger Function: Chuẩn hóa search_text không dấu khi Insert/Update
-- --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_rss_episodes_search_text()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  NEW.search_text := lower(unaccent(
    coalesce(NEW.title, '') || ' ' || 
    coalesce(NEW.extracted_sender, '') || ' ' || 
    coalesce(NEW.raw_confession, '')
  ));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_rss_episodes_search_text ON public.rss_episodes;
CREATE TRIGGER trg_update_rss_episodes_search_text
BEFORE INSERT OR UPDATE ON public.rss_episodes
FOR EACH ROW
EXECUTE FUNCTION public.trg_rss_episodes_search_text();

-- GIN Trigram index trên cột search_text đã chuẩn hóa
CREATE INDEX IF NOT EXISTS idx_rss_episodes_search_text 
ON public.rss_episodes USING GIN (search_text gin_trgm_ops);

-- ========================================================
-- 2. BẢNG QUẢN LÝ KHÓA ĐỒNG BỘ SERVERLESS (SYNC STATE)
-- ========================================================
CREATE TABLE IF NOT EXISTS public.sync_state (
  id INT PRIMARY KEY DEFAULT 1,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  locked_at TIMESTAMPTZ,
  locked_by TEXT,
  expires_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ,
  last_status VARCHAR(20),
  last_error TEXT,
  CONSTRAINT single_row CHECK (id = 1)
);

-- Khởi tạo bản ghi quản lý khóa ban đầu
INSERT INTO public.sync_state (id, is_locked) VALUES (1, false) ON CONFLICT DO NOTHING;

-- Bảng lưu lịch sử các lần sync
CREATE TABLE IF NOT EXISTS public.sync_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  status VARCHAR(20) NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  total_items INTEGER DEFAULT 0,
  inserted_items INTEGER DEFAULT 0,
  updated_items INTEGER DEFAULT 0,
  error_message TEXT,
  triggered_by VARCHAR(50) DEFAULT 'cron'
);

-- --------------------------------------------------------
-- Hàm xin khóa đồng bộ an toàn (Atomic Lock kèm TTL)
-- --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.acquire_sync_lock(
  p_worker_id TEXT, 
  p_timeout_interval INTERVAL DEFAULT INTERVAL '10 minutes'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_rows_affected INT;
BEGIN
  UPDATE public.sync_state
  SET is_locked = true,
      locked_at = NOW(),
      expires_at = NOW() + p_timeout_interval,
      locked_by = p_worker_id
  WHERE id = 1 AND (is_locked = false OR expires_at < NOW());

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
  RETURN v_rows_affected > 0;
END;
$$;

-- --------------------------------------------------------
-- Hàm giải phóng khóa: Chỉ đúng worker sở hữu khóa mới được giải phóng
-- --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.release_sync_lock(
  p_worker_id TEXT, 
  p_status VARCHAR(20) DEFAULT 'completed', 
  p_error TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_rows_affected INT;
BEGIN
  UPDATE public.sync_state
  SET is_locked = false,
      expires_at = NULL,
      last_synced_at = NOW(),
      last_status = p_status,
      last_error = p_error
  WHERE id = 1 AND locked_by = p_worker_id;

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
  RETURN v_rows_affected > 0;
END;
$$;

-- ========================================================
-- 3. BẢNG QUẢN LÝ OWNER & DỮ LIỆU CÁ NHÂN (PRIVATE ARCHIVE)
-- ========================================================

-- Bảng xác thực Owner duy nhất của kho lưu trữ (chỉ cho phép tối đa 1 Owner trong V1)
CREATE TABLE IF NOT EXISTS public.app_owner (
  id INT PRIMARY KEY DEFAULT 1,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT single_owner_row CHECK (id = 1),
  CONSTRAINT uq_app_owner_user UNIQUE (user_id)
);

-- Hàm kiểm tra user hiện tại có phải Owner hợp lệ không
CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.app_owner WHERE id = 1 AND user_id = auth.uid()
  );
$$;

-- Bảng tùy biến câu chuyện của Owner
CREATE TABLE IF NOT EXISTS public.story_curations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id UUID NOT NULL REFERENCES public.rss_episodes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  custom_title TEXT,
  custom_excerpt TEXT,
  custom_confession TEXT,
  transcript TEXT,
  custom_image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_story_curation UNIQUE (episode_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.tags (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_tag_name_user UNIQUE (name, user_id),
  CONSTRAINT uq_tag_id_user UNIQUE (id, user_id)
);

-- Ràng buộc kép: Foreign key (tag_id, user_id) ngăn chặn liên kết tag của user khác
CREATE TABLE IF NOT EXISTS public.story_tags (
  episode_id UUID NOT NULL REFERENCES public.rss_episodes(id) ON DELETE CASCADE,
  tag_id BIGINT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (episode_id, tag_id, user_id),
  CONSTRAINT fk_story_tags_tag_user FOREIGN KEY (tag_id, user_id) REFERENCES public.tags(id, user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.notes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  episode_id UUID NOT NULL REFERENCES public.rss_episodes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT DEFAULT 'Bài học',
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notes_episode_user ON public.notes (episode_id, user_id);

-- ========================================================
-- 4. VIEW TỔNG HỢP AN TOÀN (SECURITY INVOKER)
-- ========================================================
CREATE OR REPLACE VIEW public.v_stories WITH (security_invoker = true) AS
SELECT 
  e.id,
  e.guid,
  e.pub_date,
  e.duration_seconds,
  e.audio_url,
  e.source_doc_url,
  e.extracted_sender,
  e.content_status,
  COALESCE(c.custom_title, e.title) AS title,
  COALESCE(c.custom_image_url, e.channel_image_url) AS image_url,
  COALESCE(
    c.custom_excerpt, 
    CASE 
      WHEN length(e.raw_confession) > 0 THEN substring(e.raw_confession FROM 1 FOR 160) || '...'
      ELSE 'Tập tâm sự chia sẻ từ podcast Tâm Sự Buồn Vui.'
    END
  ) AS excerpt,
  COALESCE(c.custom_confession, e.raw_confession) AS confession_text,
  c.transcript,
  -- Thẻ tags của Owner
  COALESCE(
    (SELECT json_agg(t.name) 
     FROM public.story_tags st 
     JOIN public.tags t ON t.id = st.tag_id 
     WHERE st.episode_id = e.id AND st.user_id = auth.uid()),
    '[]'::json
  ) AS tags,
  -- Ghi chú gần nhất cho UI đơn lẻ hiện tại
  (SELECT content FROM public.notes n 
   WHERE n.episode_id = e.id AND n.user_id = auth.uid() 
   ORDER BY updated_at DESC LIMIT 1) AS personal_note,
  -- Toàn bộ danh sách ghi chú cho mở rộng multi-notes
  COALESCE(
    (SELECT json_agg(json_build_object('id', n.id, 'title', n.title, 'content', n.content, 'updated_at', n.updated_at) ORDER BY n.created_at ASC)
     FROM public.notes n 
     WHERE n.episode_id = e.id AND n.user_id = auth.uid()),
    '[]'::json
  ) AS all_notes
FROM public.rss_episodes e
LEFT JOIN public.story_curations c ON c.episode_id = e.id AND c.user_id = auth.uid();

-- ========================================================
-- 5. CHÍNH SÁCH BẢO MẬT (ROW LEVEL SECURITY - RLS)
-- ========================================================
ALTER TABLE public.rss_episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_owner ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_curations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

-- 1. rss_episodes: Private Archive - Chỉ tài khoản Owner được SELECT
DROP POLICY IF EXISTS "Owner select rss_episodes" ON public.rss_episodes;
CREATE POLICY "Owner select rss_episodes" 
  ON public.rss_episodes FOR SELECT 
  TO authenticated 
  USING (public.is_owner());

-- 2. sync_state & sync_logs: Chỉ Service Role server-side được phép truy cập
DROP POLICY IF EXISTS "Service role access sync_state" ON public.sync_state;
CREATE POLICY "Service role access sync_state" 
  ON public.sync_state FOR ALL 
  TO service_role 
  USING (true);

DROP POLICY IF EXISTS "Service role access sync_logs" ON public.sync_logs;
CREATE POLICY "Service role access sync_logs" 
  ON public.sync_logs FOR ALL 
  TO service_role 
  USING (true);

-- 3. app_owner: Chỉ Owner được xem thông tin chính mình
DROP POLICY IF EXISTS "Owner select app_owner" ON public.app_owner;
CREATE POLICY "Owner select app_owner" 
  ON public.app_owner FOR SELECT 
  TO authenticated 
  USING (public.is_owner());

-- 4. Bảng dữ liệu cá nhân: Bắt buộc auth.uid() = user_id VÀ phải là Owner
DROP POLICY IF EXISTS "Owner curd story_curations" ON public.story_curations;
CREATE POLICY "Owner curd story_curations" 
  ON public.story_curations FOR ALL 
  TO authenticated 
  USING (auth.uid() = user_id AND public.is_owner())
  WITH CHECK (auth.uid() = user_id AND public.is_owner());

DROP POLICY IF EXISTS "Owner curd tags" ON public.tags;
CREATE POLICY "Owner curd tags" 
  ON public.tags FOR ALL 
  TO authenticated 
  USING (auth.uid() = user_id AND public.is_owner())
  WITH CHECK (auth.uid() = user_id AND public.is_owner());

DROP POLICY IF EXISTS "Owner curd story_tags" ON public.story_tags;
CREATE POLICY "Owner curd story_tags" 
  ON public.story_tags FOR ALL 
  TO authenticated 
  USING (auth.uid() = user_id AND public.is_owner())
  WITH CHECK (auth.uid() = user_id AND public.is_owner());

DROP POLICY IF EXISTS "Owner curd notes" ON public.notes;
CREATE POLICY "Owner curd notes" 
  ON public.notes FOR ALL 
  TO authenticated 
  USING (auth.uid() = user_id AND public.is_owner())
  WITH CHECK (auth.uid() = user_id AND public.is_owner());

-- ========================================================
-- 6. PHÂN QUYỀN TRUY CẬP (GRANTS & REVOKES CỤ THỂ)
-- ========================================================

-- A. Quyền Schema: Giữ nguyên mặc định Supabase (GRANT USAGE)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- B. Bảng dữ liệu gốc:
-- rss_episodes: Authenticated được SELECT (chỉ Owner vượt qua RLS), service_role toàn quyền
GRANT SELECT ON TABLE public.rss_episodes TO authenticated;
GRANT ALL ON TABLE public.rss_episodes TO service_role;

-- sync_state & sync_logs: Chỉ service_role (thu hồi authenticated và anon)
REVOKE ALL ON TABLE public.sync_state FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.sync_logs FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.sync_state TO service_role;
GRANT ALL ON TABLE public.sync_logs TO service_role;

-- app_owner: Authenticated được SELECT để is_owner() hoạt động, service_role toàn quyền
GRANT SELECT ON TABLE public.app_owner TO authenticated;
GRANT ALL ON TABLE public.app_owner TO service_role;

-- Bảng cá nhân: Authenticated và service_role được cấp quyền (RLS kiểm soát trực tiếp)
GRANT ALL ON TABLE public.story_curations TO authenticated, service_role;
GRANT ALL ON TABLE public.tags TO authenticated, service_role;
GRANT ALL ON TABLE public.story_tags TO authenticated, service_role;
GRANT ALL ON TABLE public.notes TO authenticated, service_role;

-- C. Quyền Sequences (BIGINT IDENTITY):
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO authenticated, service_role;

-- D. View v_stories:
GRANT SELECT ON public.v_stories TO authenticated, service_role;

-- E. Functions:
-- Khóa đồng bộ: Thu hồi triệt để từ PUBLIC/anon/authenticated, CHỈ service_role được gọi
REVOKE ALL ON FUNCTION public.acquire_sync_lock(TEXT, INTERVAL) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_sync_lock(TEXT, VARCHAR, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_sync_lock(TEXT, INTERVAL) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_sync_lock(TEXT, VARCHAR, TEXT) TO service_role;

-- is_owner: Authenticated và service_role được gọi
REVOKE ALL ON FUNCTION public.is_owner() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_owner() TO authenticated, service_role;

-- Trigger Function: Thu hồi public
REVOKE ALL ON FUNCTION public.trg_rss_episodes_search_text() FROM PUBLIC, anon, authenticated;
