
-- Norm documents
CREATE TABLE IF NOT EXISTS public.norm_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  title text NOT NULL,
  category text,
  source_url text,
  file_url text,
  total_chunks integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.norm_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "norm_docs_read" ON public.norm_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "norm_docs_manage" ON public.norm_documents FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'pm') OR public.has_role(auth.uid(), 'director'))
  WITH CHECK (public.has_role(auth.uid(), 'pm') OR public.has_role(auth.uid(), 'director'));

-- Norm chunks with embeddings
CREATE TABLE IF NOT EXISTS public.norm_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.norm_documents(id) ON DELETE CASCADE,
  section text,
  content text NOT NULL,
  embedding extensions.vector(1536),
  chunk_index integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_norm_chunks_document ON public.norm_chunks(document_id);

ALTER TABLE public.norm_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "norm_chunks_read" ON public.norm_chunks FOR SELECT TO authenticated USING (true);
CREATE POLICY "norm_chunks_manage" ON public.norm_chunks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'pm') OR public.has_role(auth.uid(), 'director'))
  WITH CHECK (public.has_role(auth.uid(), 'pm') OR public.has_role(auth.uid(), 'director'));

-- ai_messages columns
ALTER TABLE public.ai_messages ADD COLUMN IF NOT EXISTS mode text DEFAULT 'project';
ALTER TABLE public.ai_messages ADD COLUMN IF NOT EXISTS citations jsonb DEFAULT '[]'::jsonb;
CREATE INDEX IF NOT EXISTS idx_ai_messages_mode ON public.ai_messages(mode);
