
-- 1. Projects: add cover_image_url
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS cover_image_url TEXT;

-- 2. Profiles: add phone, email, position, avatar_url, last_active_at
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS position TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ DEFAULT now();

-- 3. Project chats: extend with new columns
ALTER TABLE public.project_chats ADD COLUMN IF NOT EXISTS chat_type TEXT DEFAULT 'general';
ALTER TABLE public.project_chats ADD COLUMN IF NOT EXISTS reference_id UUID;
ALTER TABLE public.project_chats ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;
ALTER TABLE public.project_chats ADD COLUMN IF NOT EXISTS last_message TEXT;
ALTER TABLE public.project_chats ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ;
ALTER TABLE public.project_chats ADD COLUMN IF NOT EXISTS unread_count INTEGER DEFAULT 0;
ALTER TABLE public.project_chats ADD COLUMN IF NOT EXISTS created_by UUID;
