
CREATE TABLE IF NOT EXISTS public.bot_states (
  chat_id     TEXT PRIMARY KEY,
  state       TEXT NOT NULL,
  data        JSONB DEFAULT '{}',
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.bot_states ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_only" ON public.bot_states FOR ALL USING (false);

CREATE INDEX IF NOT EXISTS idx_profiles_telegram_chat_id
  ON public.profiles(telegram_chat_id)
  WHERE telegram_chat_id IS NOT NULL;

COMMENT ON TABLE public.bot_states IS 'Состояния многошаговых диалогов Telegram-бота';
