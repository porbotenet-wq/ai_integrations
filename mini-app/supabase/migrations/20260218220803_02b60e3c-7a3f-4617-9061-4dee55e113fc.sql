
-- 1. DAILY LOGS
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
  status text NOT NULL DEFAULT 'draft',
  submitted_by uuid,
  reviewed_by uuid,
  review_comment text,
  photo_urls text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_daily_logs_project ON daily_logs(project_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_logs_status ON daily_logs(status);

ALTER TABLE daily_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dl_sel" ON daily_logs FOR SELECT USING (project_id IN (SELECT user_project_ids()));
CREATE POLICY "dl_ins" ON daily_logs FOR INSERT WITH CHECK (project_id IN (SELECT user_project_ids()));
CREATE POLICY "dl_upd" ON daily_logs FOR UPDATE USING (project_id IN (SELECT user_project_ids()));

-- 2. APPROVALS
CREATE TABLE IF NOT EXISTS approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type text NOT NULL,
  entity_id uuid,
  title text NOT NULL,
  description text,
  requested_by uuid,
  assigned_to uuid,
  level int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pending',
  decision_comment text,
  decided_at timestamptz,
  idempotency_key text UNIQUE,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_approvals_project ON approvals(project_id);
CREATE INDEX IF NOT EXISTS idx_approvals_assigned ON approvals(assigned_to, status);

ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "appr_sel" ON approvals FOR SELECT USING (project_id IN (SELECT user_project_ids()));
CREATE POLICY "appr_ins" ON approvals FOR INSERT WITH CHECK (project_id IN (SELECT user_project_ids()));
CREATE POLICY "appr_upd" ON approvals FOR UPDATE USING (project_id IN (SELECT user_project_ids()));

-- 3. Audit triggers
CREATE TRIGGER audit_daily_logs AFTER INSERT OR UPDATE OR DELETE ON daily_logs FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();
CREATE TRIGGER audit_approvals AFTER INSERT OR UPDATE OR DELETE ON approvals FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();
