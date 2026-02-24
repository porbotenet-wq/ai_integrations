
-- Table for generated documents history
CREATE TABLE public.generated_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  template_type TEXT NOT NULL,
  title TEXT NOT NULL,
  file_url TEXT,
  file_type TEXT NOT NULL DEFAULT 'docx',
  params JSONB DEFAULT '{}'::jsonb,
  ai_content TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.generated_documents ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "gen_docs_sel" ON public.generated_documents
  FOR SELECT USING (project_id IN (SELECT user_project_ids()));

CREATE POLICY "gen_docs_ins" ON public.generated_documents
  FOR INSERT WITH CHECK (auth.uid() = created_by AND project_id IN (SELECT user_project_ids()));

CREATE POLICY "gen_docs_del" ON public.generated_documents
  FOR DELETE USING (auth.uid() = created_by);

-- Index
CREATE INDEX idx_gen_docs_project ON public.generated_documents(project_id, created_at DESC);

-- Storage bucket for generated documents
INSERT INTO storage.buckets (id, name, public) VALUES ('generated-documents', 'generated-documents', false);

-- Storage policies
CREATE POLICY "gen_docs_storage_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'generated-documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "gen_docs_storage_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'generated-documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "gen_docs_storage_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'generated-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
