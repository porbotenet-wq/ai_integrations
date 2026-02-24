
-- =============================================
-- PHASE 0: Clean existing policies + new RLS
-- =============================================

-- Drop ALL existing conflicting policies
DO $$ 
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN 
    SELECT policyname, tablename FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename IN ('profiles','projects','alerts','crews','facades','materials','plan_fact','work_types','documents','document_folders','floors','calendar_events')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- user_project_ids helper
CREATE OR REPLACE FUNCTION user_project_ids() RETURNS SETOF uuid AS $$
  SELECT id FROM projects;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- PROFILES
CREATE POLICY "profiles_sel" ON profiles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "profiles_upd" ON profiles FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "profiles_ins" ON profiles FOR INSERT WITH CHECK (user_id = auth.uid());

-- PROJECTS
CREATE POLICY "projects_sel" ON projects FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "projects_ins" ON projects FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "projects_upd" ON projects FOR UPDATE USING (auth.uid() IS NOT NULL);

-- ALERTS
CREATE POLICY "alerts_sel" ON alerts FOR SELECT USING (project_id IN (SELECT user_project_ids()));
CREATE POLICY "alerts_ins" ON alerts FOR INSERT WITH CHECK (project_id IN (SELECT user_project_ids()));
CREATE POLICY "alerts_upd" ON alerts FOR UPDATE USING (project_id IN (SELECT user_project_ids()));

-- CREWS
CREATE POLICY "crews_sel" ON crews FOR SELECT USING (project_id IN (SELECT user_project_ids()));
CREATE POLICY "crews_ins" ON crews FOR INSERT WITH CHECK (project_id IN (SELECT user_project_ids()));
CREATE POLICY "crews_upd" ON crews FOR UPDATE USING (project_id IN (SELECT user_project_ids()));

-- FACADES
CREATE POLICY "facades_sel" ON facades FOR SELECT USING (project_id IN (SELECT user_project_ids()));
CREATE POLICY "facades_ins" ON facades FOR INSERT WITH CHECK (project_id IN (SELECT user_project_ids()));
CREATE POLICY "facades_upd" ON facades FOR UPDATE USING (project_id IN (SELECT user_project_ids()));

-- MATERIALS
CREATE POLICY "materials_sel" ON materials FOR SELECT USING (project_id IN (SELECT user_project_ids()));
CREATE POLICY "materials_ins" ON materials FOR INSERT WITH CHECK (project_id IN (SELECT user_project_ids()));
CREATE POLICY "materials_upd" ON materials FOR UPDATE USING (project_id IN (SELECT user_project_ids()));

-- PLAN_FACT
CREATE POLICY "pf_sel" ON plan_fact FOR SELECT USING (project_id IN (SELECT user_project_ids()));
CREATE POLICY "pf_ins" ON plan_fact FOR INSERT WITH CHECK (project_id IN (SELECT user_project_ids()));
CREATE POLICY "pf_upd" ON plan_fact FOR UPDATE USING (project_id IN (SELECT user_project_ids()));

-- WORK_TYPES
CREATE POLICY "wt_sel" ON work_types FOR SELECT USING (project_id IN (SELECT user_project_ids()));
CREATE POLICY "wt_ins" ON work_types FOR INSERT WITH CHECK (project_id IN (SELECT user_project_ids()));
CREATE POLICY "wt_upd" ON work_types FOR UPDATE USING (project_id IN (SELECT user_project_ids()));

-- DOCUMENTS
CREATE POLICY "docs_sel" ON documents FOR SELECT USING (project_id IN (SELECT user_project_ids()));
CREATE POLICY "docs_ins" ON documents FOR INSERT WITH CHECK (project_id IN (SELECT user_project_ids()));
CREATE POLICY "docs_upd" ON documents FOR UPDATE USING (project_id IN (SELECT user_project_ids()));

-- DOCUMENT_FOLDERS
CREATE POLICY "df_sel" ON document_folders FOR SELECT USING (project_id IN (SELECT user_project_ids()));
CREATE POLICY "df_ins" ON document_folders FOR INSERT WITH CHECK (project_id IN (SELECT user_project_ids()));

-- FLOORS (через facade)
CREATE POLICY "floors_sel" ON floors FOR SELECT USING (facade_id IN (SELECT id FROM facades WHERE project_id IN (SELECT user_project_ids())));
CREATE POLICY "floors_ins" ON floors FOR INSERT WITH CHECK (facade_id IN (SELECT id FROM facades WHERE project_id IN (SELECT user_project_ids())));
CREATE POLICY "floors_upd" ON floors FOR UPDATE USING (facade_id IN (SELECT id FROM facades WHERE project_id IN (SELECT user_project_ids())));

-- CALENDAR_EVENTS
CREATE POLICY "cal_sel" ON calendar_events FOR SELECT USING (project_id IN (SELECT user_project_ids()));
CREATE POLICY "cal_ins" ON calendar_events FOR INSERT WITH CHECK (project_id IN (SELECT user_project_ids()));
CREATE POLICY "cal_upd" ON calendar_events FOR UPDATE USING (project_id IN (SELECT user_project_ids()));

-- =============================================
-- AUDIT LOG TABLE + TRIGGERS
-- =============================================
CREATE TABLE IF NOT EXISTS public.audit_log (
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

CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_ins" ON audit_log FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "audit_sel" ON audit_log FOR SELECT USING (auth.uid() IS NOT NULL);

-- Audit trigger function
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Attach to critical tables
CREATE TRIGGER audit_projects AFTER INSERT OR UPDATE OR DELETE ON projects FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();
CREATE TRIGGER audit_alerts AFTER INSERT OR UPDATE OR DELETE ON alerts FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();
CREATE TRIGGER audit_plan_fact AFTER INSERT OR UPDATE OR DELETE ON plan_fact FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();
CREATE TRIGGER audit_documents AFTER INSERT OR UPDATE OR DELETE ON documents FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();
