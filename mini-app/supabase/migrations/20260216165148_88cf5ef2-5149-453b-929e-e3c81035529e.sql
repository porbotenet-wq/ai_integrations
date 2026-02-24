
-- Telegram chats per project
CREATE TABLE public.project_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  telegram_link text NOT NULL,
  category text NOT NULL,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_project_chats_project ON public.project_chats(project_id);

ALTER TABLE public.project_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_chats" ON public.project_chats FOR SELECT USING (true);

CREATE POLICY "pm_manage_chats" ON public.project_chats FOR ALL
  USING (has_role(auth.uid(), 'pm'::app_role) OR has_role(auth.uid(), 'director'::app_role));
