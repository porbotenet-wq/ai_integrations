
-- Drop old bot_states table and create new bot_sessions + bot_audit_log

DROP TABLE IF EXISTS public.bot_states;

-- Bot sessions with FSM state, message_id for editMessage, TTL
CREATE TABLE public.bot_sessions (
  chat_id       TEXT PRIMARY KEY,
  user_id       UUID,
  state         TEXT NOT NULL DEFAULT 'IDLE',
  context       JSONB NOT NULL DEFAULT '{}'::jsonb,
  message_id    INTEGER,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '2 hours')
);

-- Index for TTL cleanup
CREATE INDEX idx_bot_sessions_expires ON public.bot_sessions(expires_at);

-- RLS: service role only (edge functions use service key)
ALTER TABLE public.bot_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_only_bot_sessions" ON public.bot_sessions
  FOR ALL USING (false);

-- Bot audit log for all actions
CREATE TABLE public.bot_audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id       TEXT NOT NULL,
  user_id       UUID,
  action        TEXT NOT NULL,
  payload       JSONB DEFAULT '{}'::jsonb,
  result        TEXT DEFAULT 'success',
  duration_ms   INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for querying by chat and time
CREATE INDEX idx_bot_audit_chat ON public.bot_audit_log(chat_id, created_at DESC);
CREATE INDEX idx_bot_audit_created ON public.bot_audit_log(created_at);

-- RLS: service role only
ALTER TABLE public.bot_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_only_bot_audit" ON public.bot_audit_log
  FOR ALL USING (false);

-- PM/Director can read audit logs
CREATE POLICY "pm_read_bot_audit" ON public.bot_audit_log
  FOR SELECT USING (
    has_role(auth.uid(), 'pm'::app_role) OR has_role(auth.uid(), 'director'::app_role)
  );
