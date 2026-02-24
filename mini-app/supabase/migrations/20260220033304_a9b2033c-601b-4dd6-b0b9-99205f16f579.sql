
-- Step 1: Extend app_role enum with project sub-roles
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'project_opr';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'project_km';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'project_kmd';

-- Step 2: Create bot_inbox table for inter-role messaging
CREATE TABLE public.bot_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  from_user_id uuid NOT NULL,
  from_role text NOT NULL,
  to_roles text[] NOT NULL DEFAULT '{}',
  type text NOT NULL DEFAULT 'document',
  title text NOT NULL,
  description text,
  file_url text,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bot_inbox ENABLE ROW LEVEL SECURITY;

-- Service-only write (edge functions use service role key)
CREATE POLICY "service_only_inbox_write" ON public.bot_inbox
  FOR ALL USING (false);

-- Authenticated users can read inbox items targeted at their roles
CREATE POLICY "inbox_read_by_role" ON public.bot_inbox
  FOR SELECT USING (
    project_id IN (SELECT user_project_ids())
  );

-- Step 3: Create bot_documents table for FSM document tracking
CREATE TABLE public.bot_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  doc_type text NOT NULL,
  file_url text,
  comment text,
  recipients text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bot_documents ENABLE ROW LEVEL SECURITY;

-- Service-only write
CREATE POLICY "service_only_docs_write" ON public.bot_documents
  FOR ALL USING (false);

-- Read by project members
CREATE POLICY "docs_read_by_project" ON public.bot_documents
  FOR SELECT USING (
    project_id IN (SELECT user_project_ids())
  );

-- Indexes for performance
CREATE INDEX idx_bot_inbox_project_status ON public.bot_inbox(project_id, status);
CREATE INDEX idx_bot_inbox_to_roles ON public.bot_inbox USING GIN(to_roles);
CREATE INDEX idx_bot_documents_project ON public.bot_documents(project_id);
CREATE INDEX idx_bot_documents_sender ON public.bot_documents(sender_id);
