-- Part 4: Agent engine/RAG/model/routing configs + section-scoped hybrid chunk search

ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS engine_type TEXT NOT NULL DEFAULT 'builtin',
  ADD COLUMN IF NOT EXISTS engine_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS rag_config JSONB NOT NULL DEFAULT '{"mode":"standard","topK":6,"rerank":false,"minScore":0.25,"citations":true}'::jsonb,
  ADD COLUMN IF NOT EXISTS model_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS routing_rules JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ai_agents_engine_type_check'
      AND conrelid = 'public.ai_agents'::regclass
  ) THEN
    ALTER TABLE public.ai_agents
      ADD CONSTRAINT ai_agents_engine_type_check
      CHECK (engine_type IN ('builtin', 'langgraph', 'adk', 'hybrid'));
  END IF;
END $$;

-- Drop prior 4-argument overload before recreating with optional p_section_ids
DROP FUNCTION IF EXISTS public.fn_hybrid_search_chunks(UUID, TEXT, vector, INT);
DROP FUNCTION IF EXISTS public.fn_hybrid_search_chunks(UUID, TEXT, vector, INT, UUID[]);

-- Hybrid search RPC function combining pgvector cosine similarity with full text search
-- & exact phrase matching, optionally restricted to an agent's allowed help_sections.
--   p_section_ids IS NULL  -> search all published workspace articles
--   p_section_ids = '{}'   -> return 0 article chunks (strict empty collection isolation)
--   p_section_ids = [...]  -> return only chunks whose article.section_id is in the list
CREATE OR REPLACE FUNCTION public.fn_hybrid_search_chunks(
  p_workspace_id UUID,
  p_query_text TEXT,
  p_query_embedding vector(768),
  p_limit INT DEFAULT 6,
  p_section_ids UUID[] DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  article_id UUID,
  article_title TEXT,
  section_name TEXT,
  article_slug TEXT,
  chunk_index INT,
  content TEXT,
  similarity FLOAT8,
  keyword_score FLOAT8,
  combined_score FLOAT8
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_has_embedding BOOLEAN := (p_query_embedding IS NOT NULL);
  v_clean_query TEXT := trim(coalesce(p_query_text, ''));
  v_tsquery tsquery;
BEGIN
  IF v_clean_query <> '' THEN
    BEGIN
      v_tsquery := plainto_tsquery('english', v_clean_query);
    EXCEPTION WHEN OTHERS THEN
      v_tsquery := NULL;
    END;
  ELSE
    v_tsquery := NULL;
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT
      c.id,
      c.article_id,
      c.article_title,
      c.section_name,
      c.article_slug,
      c.chunk_index,
      c.content,
      CASE
        WHEN v_has_embedding AND c.embedding IS NOT NULL THEN
          GREATEST(0.0::float8, (1.0::float8 - (c.embedding <=> p_query_embedding)::float8))
        ELSE 0.0::float8
      END AS sim,
      (
        CASE
          WHEN v_tsquery IS NOT NULL AND c.fts @@ v_tsquery THEN
            ts_rank_cd(c.fts, v_tsquery)::float8
          ELSE 0.0::float8
        END
        +
        CASE
          WHEN v_clean_query <> '' AND c.content ILIKE '%' || v_clean_query || '%' THEN 1.0::float8
          WHEN v_clean_query <> '' AND c.article_title ILIKE '%' || v_clean_query || '%' THEN 1.2::float8
          ELSE 0.0::float8
        END
      ) AS kw_score
    FROM public.article_chunks c
    JOIN public.articles a ON a.id = c.article_id
    WHERE c.workspace_id = p_workspace_id
      AND a.status = 'published'
      AND (
        p_section_ids IS NULL
        OR (cardinality(p_section_ids) > 0 AND a.section_id = ANY(p_section_ids))
      )
  ),
  ranked AS (
    SELECT
      candidates.*,
      (
        (0.65::float8 * candidates.sim) +
        (0.35::float8 * LEAST(candidates.kw_score, 2.0::float8) / 2.0::float8)
      ) AS comb_score
    FROM candidates
  )
  SELECT
    ranked.id,
    ranked.article_id,
    ranked.article_title,
    ranked.section_name,
    ranked.article_slug,
    ranked.chunk_index,
    ranked.content,
    ranked.sim AS similarity,
    ranked.kw_score AS keyword_score,
    ranked.comb_score AS combined_score
  FROM ranked
  WHERE (v_has_embedding AND ranked.sim > 0.25) OR ranked.kw_score > 0.05
  ORDER BY ranked.comb_score DESC, ranked.sim DESC, ranked.kw_score DESC
  LIMIT p_limit;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_hybrid_search_chunks(UUID, TEXT, vector, INT, UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_hybrid_search_chunks(UUID, TEXT, vector, INT, UUID[]) TO authenticated, service_role;
