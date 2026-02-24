
-- Fix security definer view warning
ALTER VIEW public.portfolio_stats SET (security_invoker = on);
