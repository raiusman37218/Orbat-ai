-- Part 5: Advanced RAG neighbor indexes & file/URL Knowledge Sources registry

-- 1. Track uploaded documents (PDF, DOCX, TXT, MD) and scraped website URLs
CREATE TABLE IF NOT EXISTS public.knowledge_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('file', 'url')),
  title TEXT NOT NULL,
  source_url TEXT,
  file_name TEXT,
  mime_type TEXT,
  file_size INTEGER,
  section_id UUID REFERENCES public.help_sections(id) ON DELETE SET NULL,
  article_id UUID REFERENCES public.articles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'indexed' CHECK (status IN ('processing', 'indexed', 'failed')),
  chunk_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_sources_workspace_created
  ON public.knowledge_sources (workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_knowledge_sources_article
  ON public.knowledge_sources (article_id)
  WHERE article_id IS NOT NULL;

ALTER TABLE public.knowledge_sources ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'knowledge_sources' AND policyname = 'Workspace members can read knowledge sources'
  ) THEN
    CREATE POLICY "Workspace members can read knowledge sources"
    ON public.knowledge_sources
    FOR SELECT
    TO authenticated
    USING (public.fn_is_workspace_member(workspace_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'knowledge_sources' AND policyname = 'Workspace members can insert knowledge sources'
  ) THEN
    CREATE POLICY "Workspace members can insert knowledge sources"
    ON public.knowledge_sources
    FOR INSERT
    TO authenticated
    WITH CHECK (workspace_id IS NOT NULL AND public.fn_is_workspace_member(workspace_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'knowledge_sources' AND policyname = 'Workspace members can update knowledge sources'
  ) THEN
    CREATE POLICY "Workspace members can update knowledge sources"
    ON public.knowledge_sources
    FOR UPDATE
    TO authenticated
    USING (public.fn_is_workspace_member(workspace_id))
    WITH CHECK (workspace_id IS NOT NULL AND public.fn_is_workspace_member(workspace_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'knowledge_sources' AND policyname = 'Workspace members can delete knowledge sources'
  ) THEN
    CREATE POLICY "Workspace members can delete knowledge sources"
    ON public.knowledge_sources
    FOR DELETE
    TO authenticated
    USING (public.fn_is_workspace_member(workspace_id));
  END IF;
END $$;

GRANT ALL ON public.knowledge_sources TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_sources TO authenticated;

-- 2. Fast adjacent-chunk (parent-child) lookup indexes & optional parent section link
ALTER TABLE public.article_chunks
  ADD COLUMN IF NOT EXISTS parent_section_id UUID REFERENCES public.help_sections(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_article_chunks_neighbor
  ON public.article_chunks (workspace_id, article_id, chunk_index);

CREATE INDEX IF NOT EXISTS idx_bot_knowledge_chunks_neighbor
  ON public.bot_knowledge_chunks (workspace_id, knowledge_id, chunk_index);

UPDATE public.article_chunks ac
SET parent_section_id = a.section_id
FROM public.articles a
WHERE ac.article_id = a.id
  AND ac.parent_section_id IS NULL
  AND a.section_id IS NOT NULL;
