
-- 3.1 notifications_config
CREATE TABLE IF NOT EXISTS public.notifications_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  morning_briefing BOOLEAN DEFAULT true,
  report_reminder BOOLEAN DEFAULT true,
  deadline_alerts BOOLEAN DEFAULT true,
  dnd_start TIME DEFAULT '22:00',
  dnd_end TIME DEFAULT '07:00',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.notifications_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own config" ON public.notifications_config
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3.2 stage_acceptance
CREATE TABLE IF NOT EXISTS public.stage_acceptance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  facade_id UUID REFERENCES facades(id),
  floor_id UUID REFERENCES floors(id),
  stage TEXT NOT NULL,
  status TEXT DEFAULT 'not_started',
  foreman_id UUID,
  inspector_id UUID,
  pto_id UUID,
  ready_at TIMESTAMPTZ,
  inspected_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.stage_acceptance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view stage_acceptance" ON public.stage_acceptance
  FOR SELECT USING (
    project_id IN (SELECT user_project_ids())
  );

CREATE POLICY "Foremen can update stage_acceptance" ON public.stage_acceptance
  FOR UPDATE USING (
    has_role(auth.uid(), 'foreman1'::app_role) OR
    has_role(auth.uid(), 'foreman2'::app_role) OR
    has_role(auth.uid(), 'foreman3'::app_role) OR
    has_role(auth.uid(), 'pm'::app_role) OR
    has_role(auth.uid(), 'director'::app_role)
  );

CREATE POLICY "PM/Director can insert stage_acceptance" ON public.stage_acceptance
  FOR INSERT WITH CHECK (
    project_id IN (SELECT user_project_ids())
  );

-- 3.3 New columns on ecosystem_tasks
ALTER TABLE public.ecosystem_tasks ADD COLUMN IF NOT EXISTS assigned_role TEXT;
ALTER TABLE public.ecosystem_tasks ADD COLUMN IF NOT EXISTS deadline TIMESTAMPTZ;
ALTER TABLE public.ecosystem_tasks ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT false;

-- 3.4 Indexes
CREATE INDEX IF NOT EXISTS idx_daily_logs_submitted_date ON daily_logs(submitted_by, date);
CREATE INDEX IF NOT EXISTS idx_ecosystem_tasks_deadline ON ecosystem_tasks(deadline, status) WHERE status != 'Выполнено';
CREATE INDEX IF NOT EXISTS idx_stage_acceptance_project ON stage_acceptance(project_id, status);
