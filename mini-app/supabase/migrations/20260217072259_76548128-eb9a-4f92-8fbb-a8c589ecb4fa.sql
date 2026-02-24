
ALTER TABLE public.ai_chat_messages 
ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id),
ADD COLUMN IF NOT EXISTS conversation_id text;
