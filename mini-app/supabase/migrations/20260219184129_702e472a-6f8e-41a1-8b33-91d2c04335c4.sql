
-- Fix: holding_portfolio should use SECURITY INVOKER (default for views)
DROP VIEW IF EXISTS public.holding_portfolio;
CREATE VIEW public.holding_portfolio WITH (security_invoker = true) AS
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
