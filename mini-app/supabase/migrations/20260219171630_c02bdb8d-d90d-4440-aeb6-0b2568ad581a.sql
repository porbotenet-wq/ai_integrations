
-- Add missing columns to bot_event_queue to match worker schema
ALTER TABLE bot_event_queue
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','sent','failed','skipped')),
  ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS target_users TEXT[] DEFAULT '{}';

-- Migrate existing data: mark processed records as sent
UPDATE bot_event_queue SET status = 'sent' WHERE processed_at IS NOT NULL;

-- Create index for worker query
CREATE INDEX IF NOT EXISTS idx_queue_status_scheduled
  ON bot_event_queue(status, scheduled_at)
  WHERE status = 'pending';

-- Add notification_preferences to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{
    "alert_created": true,
    "alert_overdue": true,
    "stage_overdue": true,
    "daily_report_missing": true,
    "supply_overdue": true,
    "project_summary": false,
    "do_not_disturb_from": "23:00",
    "do_not_disturb_to": "07:00"
  }'::jsonb;

-- Create index on telegram_chat_id if not exists
CREATE INDEX IF NOT EXISTS idx_profiles_telegram
  ON profiles(telegram_chat_id)
  WHERE telegram_chat_id IS NOT NULL;

-- cleanup_expired_bot_sessions function
CREATE OR REPLACE FUNCTION public.cleanup_expired_bot_sessions()
RETURNS INTEGER AS $$
DECLARE deleted INTEGER;
BEGIN
  DELETE FROM bot_sessions WHERE expires_at < NOW() AND state = 'IDLE';
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- refresh_portfolio_stats function (for materialized view)
CREATE OR REPLACE FUNCTION public.refresh_portfolio_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY portfolio_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
