
-- ═══════════════════════════════════════════════════════════════
-- STSphera v3.0 — Holding + 1C Sync Migration
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Companies table ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.companies (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL,
  inn           TEXT        UNIQUE,
  code          TEXT        UNIQUE,
  logo_url      TEXT,
  bot_token     TEXT,
  bot_username  TEXT,
  mini_app_url  TEXT,
  primary_color TEXT        DEFAULT '#2563eb',
  holding_id    UUID        REFERENCES public.companies(id) ON DELETE SET NULL,
  is_active     BOOLEAN     DEFAULT TRUE,
  settings      JSONB       DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Companies visible to authenticated users
CREATE POLICY "companies_sel" ON public.companies
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Only directors can manage companies
CREATE POLICY "companies_manage" ON public.companies
  FOR ALL USING (
    has_role(auth.uid(), 'director'::app_role) OR has_role(auth.uid(), 'pm'::app_role)
  );

-- ── 2. Add company_id to existing tables ────────────────────
ALTER TABLE public.projects    ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.profiles    ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;
ALTER TABLE public.user_roles  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.alerts      ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.materials   ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.orders      ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.plan_fact   ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.crews       ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.bot_sessions ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);

-- Scope column for holding-level roles
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS scope TEXT DEFAULT 'company' CHECK (scope IN ('company', 'holding'));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_projects_company   ON public.projects(company_id);
CREATE INDEX IF NOT EXISTS idx_profiles_company   ON public.profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_alerts_company     ON public.alerts(company_id);
CREATE INDEX IF NOT EXISTS idx_materials_company  ON public.materials(company_id);

-- ── 3. RLS helper functions ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.current_company_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM profiles WHERE user_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_holding_director()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
      AND role = 'director'
      AND scope = 'holding'
  )
$$;

CREATE OR REPLACE FUNCTION public.accessible_company_ids()
RETURNS UUID[]
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
BEGIN
  SELECT p.company_id INTO v_company_id
  FROM profiles p WHERE p.user_id = auth.uid();

  IF v_company_id IS NULL THEN
    RETURN ARRAY[]::UUID[];
  END IF;

  IF is_holding_director() THEN
    RETURN ARRAY(
      SELECT id FROM companies
      WHERE id = v_company_id
         OR holding_id = v_company_id
         OR holding_id = (SELECT holding_id FROM companies WHERE id = v_company_id)
    );
  END IF;

  RETURN ARRAY[v_company_id];
END;
$$;

-- ── 4. Company isolation RLS policies (additive) ────────────
-- These work alongside existing user_project_ids() policies
CREATE POLICY "projects_company_isolation" ON public.projects
  FOR SELECT USING (company_id IS NULL OR company_id = ANY(accessible_company_ids()));

CREATE POLICY "alerts_company_isolation" ON public.alerts
  FOR SELECT USING (company_id IS NULL OR company_id = ANY(accessible_company_ids()));

CREATE POLICY "materials_company_isolation" ON public.materials
  FOR SELECT USING (company_id IS NULL OR company_id = ANY(accessible_company_ids()));

-- ── 5. sync_log table ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sync_log (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID        REFERENCES public.companies(id) ON DELETE CASCADE,
  direction       TEXT        NOT NULL CHECK (direction IN ('1c_to_app', 'app_to_1c')),
  entity          TEXT        NOT NULL,
  records_synced  INTEGER     DEFAULT 0,
  errors_count    INTEGER     DEFAULT 0,
  details         TEXT,
  synced_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sync_log_sel" ON public.sync_log
  FOR SELECT USING (has_role(auth.uid(), 'director'::app_role) OR has_role(auth.uid(), 'pm'::app_role));

CREATE INDEX IF NOT EXISTS idx_sync_log_company ON public.sync_log(company_id, synced_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_log_entity  ON public.sync_log(entity, synced_at DESC);

CREATE OR REPLACE FUNCTION public.cleanup_sync_log()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM sync_log WHERE synced_at < NOW() - INTERVAL '90 days';
$$;

-- ── 6. Sync columns on existing tables ──────────────────────
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS updated_from_1c TIMESTAMPTZ;
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS synced_to_1c    TIMESTAMPTZ;

ALTER TABLE public.plan_fact ADD COLUMN IF NOT EXISTS ref_1c       TEXT;
ALTER TABLE public.plan_fact ADD COLUMN IF NOT EXISTS synced_to_1c TIMESTAMPTZ;

ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS synced_to_1c TIMESTAMPTZ;

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS supplier_name   TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS synced_to_1c    TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS updated_from_1c TIMESTAMPTZ;

-- ── 7. Performance indexes ──────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_projects_status_company ON public.projects(company_id, status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_alerts_unresolved ON public.alerts(company_id, priority, created_at DESC) WHERE is_resolved = FALSE;
CREATE INDEX IF NOT EXISTS idx_materials_deficit ON public.materials(company_id) WHERE deficit > 0;
CREATE INDEX IF NOT EXISTS idx_orders_company ON public.orders(company_id, status);

-- ── 8. Holding portfolio view ───────────────────────────────
CREATE OR REPLACE VIEW public.holding_portfolio AS
SELECT
  c.id                                          AS company_id,
  c.name                                        AS company_name,
  c.code                                        AS company_code,
  COUNT(DISTINCT p.id)                          AS total_projects,
  COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'active') AS active_projects,
  ROUND(AVG(ps.progress_pct))                   AS avg_progress,
  SUM(ps.open_alerts)                           AS total_alerts,
  SUM(ps.critical_alerts)                       AS critical_alerts,
  SUM(ps.deficit_materials)                     AS deficit_materials,
  MIN(ps.days_until_deadline)                   AS nearest_deadline_days
FROM public.companies c
LEFT JOIN public.projects p         ON p.company_id = c.id
LEFT JOIN public.portfolio_stats ps ON ps.project_id = p.id
WHERE c.is_active = TRUE
GROUP BY c.id, c.name, c.code;
