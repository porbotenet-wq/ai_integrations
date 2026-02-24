
-- telegram_username в profiles (telegram_chat_id уже есть)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS telegram_username TEXT;

-- input_type в plan_fact
ALTER TABLE public.plan_fact
  ADD COLUMN IF NOT EXISTS input_type TEXT DEFAULT 'manual';

-- Функция get_user_roles
CREATE OR REPLACE FUNCTION public.get_user_roles(p_user_id UUID)
RETURNS app_role[]
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ARRAY_AGG(role) FROM user_roles WHERE user_id = p_user_id
$$;

-- Индекс на telegram_chat_id (если ещё нет)
CREATE INDEX IF NOT EXISTS idx_profiles_tg_chat
  ON public.profiles(telegram_chat_id)
  WHERE telegram_chat_id IS NOT NULL;

-- Индексы для bot_event_queue
CREATE INDEX IF NOT EXISTS idx_queue_pending
  ON public.bot_event_queue(scheduled_at, priority DESC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_queue_project
  ON public.bot_event_queue(project_id, status);

-- RLS: пользователь видит свою сессию
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'auth_read_bot_sessions' AND tablename = 'bot_sessions'
  ) THEN
    CREATE POLICY "auth_read_bot_sessions" ON public.bot_sessions
      FOR SELECT TO authenticated USING (user_id = auth.uid());
  END IF;
END $$;

-- Realtime для очереди
ALTER PUBLICATION supabase_realtime ADD TABLE public.bot_event_queue;
