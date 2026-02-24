-- ============================================
-- ФАЗА 3: Approvals, DailyLogs, AuditLog
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

CREATE INDEX idx_daily_logs_project ON daily_logs(project_id, date);
CREATE INDEX idx_daily_logs_status ON daily_logs(status);
CREATE INDEX idx_daily_logs_submitted ON daily_logs(submitted_by);

ALTER TABLE daily_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dl_sel" ON daily_logs FOR SELECT USING (project_id IN (SELECT user_project_ids()));
CREATE POLICY "dl_ins" ON daily_logs FOR INSERT WITH CHECK (project_id IN (SELECT user_project_ids()));
CREATE POLICY "dl_upd" ON daily_logs FOR UPDATE USING (project_id IN (SELECT user_project_ids()));

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

CREATE INDEX idx_approvals_project ON approvals(project_id);
CREATE INDEX idx_approvals_assigned ON approvals(assigned_to, status);
CREATE INDEX idx_approvals_status ON approvals(status);

ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "appr_sel" ON approvals FOR SELECT USING (project_id IN (SELECT user_project_ids()));
CREATE POLICY "appr_ins" ON approvals FOR INSERT WITH CHECK (project_id IN (SELECT user_project_ids()));
CREATE POLICY "appr_upd" ON approvals FOR UPDATE USING (project_id IN (SELECT user_project_ids()));

-- 3. AUDIT LOG — immutable
CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correlation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_role text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_actor ON audit_log(actor_id);
CREATE INDEX idx_audit_created ON audit_log(created_at);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_ins" ON audit_log FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "audit_sel" ON audit_log FOR SELECT USING (auth.uid() IS NOT NULL);
-- NO UPDATE/DELETE = immutable

-- 4. AUDIT TRIGGER
CREATE OR REPLACE FUNCTION audit_trigger_fn() RETURNS trigger AS $$
BEGIN
  INSERT INTO audit_log (actor_id, action, entity_type, entity_id, old_values, new_values)
  VALUES (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach to critical tables
CREATE TRIGGER audit_projects AFTER INSERT OR UPDATE OR DELETE ON projects FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();
CREATE TRIGGER audit_daily_logs AFTER INSERT OR UPDATE OR DELETE ON daily_logs FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();
CREATE TRIGGER audit_approvals AFTER INSERT OR UPDATE OR DELETE ON approvals FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();
CREATE TRIGGER audit_alerts AFTER INSERT OR UPDATE OR DELETE ON alerts FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();
