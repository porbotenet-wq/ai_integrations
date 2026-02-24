
-- Колонка telegram_chat_id в profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS telegram_chat_id text;

-- Таблица логов уведомлений
CREATE TABLE IF NOT EXISTS public.telegram_notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid REFERENCES public.projects(id),
  event_type text NOT NULL,
  success boolean NOT NULL DEFAULT false,
  message_preview text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.telegram_notification_log ENABLE ROW LEVEL SECURITY;

-- PM/директор могут видеть логи
CREATE POLICY "pm_read_notification_log" ON public.telegram_notification_log
  FOR SELECT USING (
    has_role(auth.uid(), 'pm'::app_role) OR has_role(auth.uid(), 'director'::app_role)
  );

-- Edge function вставляет через service role, не нужна INSERT policy для обычных пользователей
