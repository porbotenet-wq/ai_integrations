-- Bot FSM sessions table
CREATE TABLE IF NOT EXISTS bot_sessions (
  telegram_id bigint PRIMARY KEY,
  state text NOT NULL DEFAULT 'idle',
  context jsonb DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);

-- Only service_role access (bot uses service key)
ALTER TABLE bot_sessions ENABLE ROW LEVEL SECURITY;
