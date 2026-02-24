
-- 1. Materialized-like view: portfolio_stats
-- Using a regular view for simplicity (no REFRESH needed)
CREATE OR REPLACE VIEW public.portfolio_stats AS
SELECT
  p.id AS project_id,
  p.name AS project_name,
  p.code AS project_code,
  p.status AS project_status,
  COALESCE(pf_agg.total_plan, 0) AS total_plan,
  COALESCE(pf_agg.total_fact, 0) AS total_fact,
  CASE WHEN COALESCE(pf_agg.total_plan, 0) > 0
    THEN ROUND((COALESCE(pf_agg.total_fact, 0) / pf_agg.total_plan * 100)::numeric, 0)::int
    ELSE 0
  END AS progress_pct,
  COALESCE(al_agg.open_alerts, 0) AS open_alerts,
  COALESCE(al_agg.critical_alerts, 0) AS critical_alerts,
  COALESCE(mat_agg.deficit_materials, 0) AS deficit_materials,
  CASE WHEN p.end_date IS NOT NULL
    THEN (p.end_date - CURRENT_DATE)
    ELSE NULL
  END AS days_until_deadline
FROM public.projects p
LEFT JOIN LATERAL (
  SELECT
    SUM(plan_value) AS total_plan,
    SUM(fact_value) AS total_fact
  FROM public.plan_fact WHERE project_id = p.id
) pf_agg ON true
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) FILTER (WHERE NOT is_resolved) AS open_alerts,
    COUNT(*) FILTER (WHERE NOT is_resolved AND priority = 'critical') AS critical_alerts
  FROM public.alerts WHERE project_id = p.id
) al_agg ON true
LEFT JOIN LATERAL (
  SELECT COUNT(*) FILTER (WHERE deficit > 0) AS deficit_materials
  FROM public.materials WHERE project_id = p.id
) mat_agg ON true
WHERE p.status IN ('active', 'draft');

-- 2. Event queue table for async notifications
CREATE TABLE IF NOT EXISTS public.bot_event_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  project_id uuid REFERENCES public.projects(id),
  target_roles text[] DEFAULT '{}',
  target_chat_ids text[] DEFAULT '{}',
  payload jsonb DEFAULT '{}',
  priority text NOT NULL DEFAULT 'normal',
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bot_event_queue ENABLE ROW LEVEL SECURITY;

-- Only service role can access (edge functions use service key)
CREATE POLICY "service_only_event_queue" ON public.bot_event_queue
  FOR ALL USING (false);

CREATE INDEX IF NOT EXISTS idx_bot_event_queue_pending
  ON public.bot_event_queue (scheduled_at)
  WHERE processed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_bot_event_queue_type
  ON public.bot_event_queue (event_type);
