-- ========================================================
-- LIFE ARCHIVE V0.5 - MIGRATION TÌM KIẾM TỐI ƯU & GHI CHÚ
-- Phiên bản: 1.0 (Production Candidate - Chờ duyệt trước khi chạy)
-- ========================================================

SET search_path TO public, extensions;

-- 1. Kích hoạt extensions nếu chưa có
CREATE EXTENSION IF NOT EXISTS "unaccent";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 2. Index GIN Trigram trên notes.content để tìm kiếm ghi chú cá nhân siêu tốc
CREATE INDEX IF NOT EXISTS idx_notes_content_trgm 
ON public.notes USING GIN (content gin_trgm_ops);

-- 3. Index GIN Trigram trên tags.name để tìm kiếm thẻ tùy biến
CREATE INDEX IF NOT EXISTS idx_tags_name_trgm 
ON public.tags USING GIN (name gin_trgm_ops);

-- 4. Stored Function tìm kiếm tổng hợp Life Archive V0.5
-- Đảm bảo SECURITY INVOKER để tuân thủ RLS của Supabase
CREATE OR REPLACE FUNCTION public.search_archive_stories_v05(
  p_query TEXT DEFAULT '',
  p_status TEXT DEFAULT NULL,
  p_tag TEXT DEFAULT NULL,
  p_has_notes BOOLEAN DEFAULT NULL,
  p_sort_by TEXT DEFAULT 'pub_date',
  p_sort_order TEXT DEFAULT 'desc',
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  guid TEXT,
  pub_date TIMESTAMPTZ,
  duration_seconds INT,
  audio_url TEXT,
  source_doc_url TEXT,
  extracted_sender TEXT,
  content_status VARCHAR(20),
  title TEXT,
  image_url TEXT,
  excerpt TEXT,
  tags JSON,
  notes_count BIGINT,
  has_notes BOOLEAN,
  relevance_score INT,
  total_count BIGINT
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_clean_q TEXT;
  v_valid_sort_by TEXT;
  v_valid_sort_order TEXT;
BEGIN
  -- 1. Chuẩn hóa từ khóa tìm kiếm: bỏ dấu, chữ thường, cắt khoảng trắng
  v_clean_q := lower(unaccent(trim(coalesce(p_query, ''))));

  -- 2. Whitelist trường sắp xếp hợp lệ chống SQL injection và lỗi schema
  v_valid_sort_by := CASE 
    WHEN lower(p_sort_by) IN ('pub_date', 'title', 'extracted_sender', 'duration_seconds', 'content_status', 'source', 'id', 'guid') 
    THEN lower(p_sort_by) 
    ELSE 'pub_date' 
  END;

  -- 3. Whitelist hướng sắp xếp
  v_valid_sort_order := CASE 
    WHEN lower(p_sort_order) = 'asc' THEN 'asc' 
    ELSE 'desc' 
  END;

  RETURN QUERY
  WITH filtered_episodes AS (
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
      -- Tags của Owner
      COALESCE(
        (SELECT json_agg(t.name) 
         FROM public.story_tags st 
         JOIN public.tags t ON t.id = st.tag_id 
         WHERE st.episode_id = e.id AND st.user_id = auth.uid()),
        '[]'::json
      ) AS tags,
      -- Số lượng ghi chú của Owner (Payload tinh gọn: KHÔNG trả về content chi tiết)
      (SELECT count(*) FROM public.notes n 
       WHERE n.episode_id = e.id AND n.user_id = auth.uid()) AS notes_count,
      ((SELECT count(*) FROM public.notes n 
        WHERE n.episode_id = e.id AND n.user_id = auth.uid()) > 0) AS has_notes,
      -- Tính điểm mức độ phù hợp (Relevance Ranking Score)
      (
        CASE 
          WHEN v_clean_q = '' THEN 0
          -- Khớp chính xác tiêu đề
          WHEN lower(unaccent(COALESCE(c.custom_title, e.title))) = v_clean_q THEN 100
          -- Bắt đầu bằng từ khóa
          WHEN lower(unaccent(COALESCE(c.custom_title, e.title))) ILIKE (v_clean_q || '%') THEN 80
          -- Chứa từ khóa trong tiêu đề
          WHEN lower(unaccent(COALESCE(c.custom_title, e.title))) ILIKE ('%' || v_clean_q || '%') THEN 60
          ELSE 0 
        END
        +
        -- Khớp người gửi
        CASE 
          WHEN v_clean_q != '' AND lower(unaccent(coalesce(e.extracted_sender, ''))) ILIKE ('%' || v_clean_q || '%') THEN 50 
          ELSE 0 
        END
        +
        -- Khớp tag cá nhân
        CASE 
          WHEN v_clean_q != '' AND EXISTS (
            SELECT 1 FROM public.story_tags st 
            JOIN public.tags t ON t.id = st.tag_id 
            WHERE st.episode_id = e.id AND st.user_id = auth.uid() 
            AND lower(unaccent(t.name)) ILIKE ('%' || v_clean_q || '%')
          ) THEN 40 
          ELSE 0 
        END
        +
        -- Khớp nội dung ghi chú cá nhân
        CASE 
          WHEN v_clean_q != '' AND EXISTS (
            SELECT 1 FROM public.notes n 
            WHERE n.episode_id = e.id AND n.user_id = auth.uid() 
            AND lower(unaccent(n.content)) ILIKE ('%' || v_clean_q || '%')
          ) THEN 30 
          ELSE 0 
        END
        +
        -- Khớp trích đoạn confession gốc
        CASE 
          WHEN v_clean_q != '' AND lower(unaccent(coalesce(e.raw_confession, ''))) ILIKE ('%' || v_clean_q || '%') THEN 20 
          ELSE 0 
        END
        +
        -- Khớp transcript
        CASE 
          WHEN v_clean_q != '' AND lower(unaccent(coalesce(c.transcript, ''))) ILIKE ('%' || v_clean_q || '%') THEN 15 
          ELSE 0 
        END
      )::INT AS relevance_score
    FROM public.rss_episodes e
    LEFT JOIN public.story_curations c ON c.episode_id = e.id AND c.user_id = auth.uid()
    WHERE 
      -- Bộ lọc Content Status
      (p_status IS NULL OR p_status = 'all' OR e.content_status = p_status)
      AND
      -- Bộ lọc Tag
      (p_tag IS NULL OR p_tag = '' OR EXISTS (
        SELECT 1 FROM public.story_tags st2 
        JOIN public.tags t2 ON t2.id = st2.tag_id 
        WHERE st2.episode_id = e.id AND st2.user_id = auth.uid() AND t2.name = p_tag
      ))
      AND
      -- Bộ lọc đã có ghi chú
      (p_has_notes IS NULL OR (
        (SELECT count(*) FROM public.notes n2 WHERE n2.episode_id = e.id AND n2.user_id = auth.uid()) > 0
      ) = p_has_notes)
      AND
      -- Điều kiện tìm kiếm từ khóa đa trường
      (
        v_clean_q = '' 
        OR lower(unaccent(COALESCE(c.custom_title, e.title))) ILIKE ('%' || v_clean_q || '%')
        OR lower(unaccent(coalesce(e.extracted_sender, ''))) ILIKE ('%' || v_clean_q || '%')
        OR lower(unaccent(coalesce(e.raw_confession, ''))) ILIKE ('%' || v_clean_q || '%')
        OR lower(unaccent(coalesce(c.transcript, ''))) ILIKE ('%' || v_clean_q || '%')
        OR EXISTS (
          SELECT 1 FROM public.story_tags st3 
          JOIN public.tags t3 ON t3.id = st3.tag_id 
          WHERE st3.episode_id = e.id AND st3.user_id = auth.uid() 
          AND lower(unaccent(t3.name)) ILIKE ('%' || v_clean_q || '%')
        )
        OR EXISTS (
          SELECT 1 FROM public.notes n3 
          WHERE n3.episode_id = e.id AND n3.user_id = auth.uid() 
          AND lower(unaccent(n3.content)) ILIKE ('%' || v_clean_q || '%')
        )
      )
  ),
  counted AS (
    SELECT count(*) AS total_rows FROM filtered_episodes
  )
  SELECT 
    f.id,
    f.guid,
    f.pub_date,
    f.duration_seconds,
    f.audio_url,
    f.source_doc_url,
    f.extracted_sender,
    f.content_status,
    f.title,
    f.image_url,
    f.excerpt,
    f.tags,
    f.notes_count,
    f.has_notes,
    f.relevance_score,
    c.total_rows AS total_count
  FROM filtered_episodes f
  CROSS JOIN counted c
  ORDER BY 
    -- Nếu có tìm kiếm từ khóa và không chỉ định sort khác, ưu tiên theo relevance_score
    CASE WHEN v_clean_q != '' AND v_valid_sort_by = 'pub_date' AND v_valid_sort_order = 'desc' THEN f.relevance_score END DESC NULLS LAST,
    -- Sắp xếp theo ngày phát sóng
    CASE WHEN v_valid_sort_by = 'pub_date' AND v_valid_sort_order = 'asc' THEN f.pub_date END ASC NULLS LAST,
    CASE WHEN v_valid_sort_by = 'pub_date' AND v_valid_sort_order = 'desc' THEN f.pub_date END DESC NULLS LAST,
    -- Sắp xếp theo tiêu đề
    CASE WHEN v_valid_sort_by = 'title' AND v_valid_sort_order = 'asc' THEN f.title END ASC NULLS LAST,
    CASE WHEN v_valid_sort_by = 'title' AND v_valid_sort_order = 'desc' THEN f.title END DESC NULLS LAST,
    -- Sắp xếp theo người gửi
    CASE WHEN v_valid_sort_by = 'extracted_sender' AND v_valid_sort_order = 'asc' THEN f.extracted_sender END ASC NULLS LAST,
    CASE WHEN v_valid_sort_by = 'extracted_sender' AND v_valid_sort_order = 'desc' THEN f.extracted_sender END DESC NULLS LAST,
    -- Sắp xếp theo thời lượng
    CASE WHEN v_valid_sort_by = 'duration_seconds' AND v_valid_sort_order = 'asc' THEN f.duration_seconds END ASC NULLS LAST,
    CASE WHEN v_valid_sort_by = 'duration_seconds' AND v_valid_sort_order = 'desc' THEN f.duration_seconds END DESC NULLS LAST,
    -- Sắp xếp theo trạng thái nội dung
    CASE WHEN v_valid_sort_by = 'content_status' AND v_valid_sort_order = 'asc' THEN f.content_status END ASC NULLS LAST,
    CASE WHEN v_valid_sort_by = 'content_status' AND v_valid_sort_order = 'desc' THEN f.content_status END DESC NULLS LAST,
    -- Sắp xếp theo nguồn
    CASE WHEN v_valid_sort_by = 'source' AND v_valid_sort_order = 'asc' THEN f.source_doc_url END ASC NULLS LAST,
    CASE WHEN v_valid_sort_by = 'source' AND v_valid_sort_order = 'desc' THEN f.source_doc_url END DESC NULLS LAST,
    -- Sắp xếp theo ID/GUID
    CASE WHEN v_valid_sort_by IN ('id', 'guid') AND v_valid_sort_order = 'asc' THEN f.guid END ASC NULLS LAST,
    CASE WHEN v_valid_sort_by IN ('id', 'guid') AND v_valid_sort_order = 'desc' THEN f.guid END DESC NULLS LAST
  LIMIT p_limit OFFSET p_offset;
END;
$$;

-- 5. Phân quyền truy cập Function an toàn
REVOKE ALL ON FUNCTION public.search_archive_stories_v05(TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT, INT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_archive_stories_v05(TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT, INT, INT) TO authenticated, service_role;

