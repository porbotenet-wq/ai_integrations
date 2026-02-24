-- ============================================
-- Создание недостающих таблиц: approvals, daily_logs
-- Безопасно: IF NOT EXISTS + проверки
-- ============================================

-- 1. DAILY LOGS — дневные отчёты
CREATE TABLE IF NOT EXISTS daily_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  zone_name text,
  date date NOT NULL DEFAULT CURRENT_DATE,
  works_description text NOT NULL,
  volume text,
  workers_count int,
  issues_description text,
  weather text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','reviewed','approved','rejected')),
  submitted_by uuid REFERENCES auth.users(id),
  reviewed_by uuid REFERENCES auth.users(id),
  review_comment text,
  photo_urls text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_daily_logs_project ON daily_logs(project_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_logs_status ON daily_logs(status);
CREATE INDEX IF NOT EXISTS idx_daily_logs_submitted ON daily_logs(submitted_by);

ALTER TABLE daily_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'daily_logs' AND policyname = 'dl_sel') THEN
    CREATE POLICY "dl_sel" ON daily_logs FOR SELECT USING (project_id IN (SELECT user_project_ids()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'daily_logs' AND policyname = 'dl_ins') THEN
    CREATE POLICY "dl_ins" ON daily_logs FOR INSERT WITH CHECK (project_id IN (SELECT user_project_ids()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'daily_logs' AND policyname = 'dl_upd') THEN
    CREATE POLICY "dl_upd" ON daily_logs FOR UPDATE USING (project_id IN (SELECT user_project_ids()));
  END IF;
END $$;

-- 2. APPROVALS — согласования
CREATE TABLE IF NOT EXISTS approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('daily_log','material_request','task_completion','budget','other')),
  entity_id uuid,
  title text NOT NULL,
  description text,
  requested_by uuid REFERENCES auth.users(id),
  assigned_to uuid REFERENCES auth.users(id),
  level int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  decision_comment text,
  decided_at timestamptz,
  idempotency_key text UNIQUE,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_approvals_project ON approvals(project_id);
CREATE INDEX IF NOT EXISTS idx_approvals_assigned ON approvals(assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status);

ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'approvals' AND policyname = 'appr_sel') THEN
    CREATE POLICY "appr_sel" ON approvals FOR SELECT USING (project_id IN (SELECT user_project_ids()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'approvals' AND policyname = 'appr_ins') THEN
    CREATE POLICY "appr_ins" ON approvals FOR INSERT WITH CHECK (project_id IN (SELECT user_project_ids()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'approvals' AND policyname = 'appr_upd') THEN
    CREATE POLICY "appr_upd" ON approvals FOR UPDATE USING (project_id IN (SELECT user_project_ids()));
  END IF;
END $$;

-- 3. Audit triggers for new tables (safe: OR REPLACE + IF NOT EXISTS pattern)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_daily_logs') THEN
    CREATE TRIGGER audit_daily_logs AFTER INSERT OR UPDATE OR DELETE ON daily_logs FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_approvals') THEN
    CREATE TRIGGER audit_approvals AFTER INSERT OR UPDATE OR DELETE ON approvals FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();
  END IF;
END $$;
