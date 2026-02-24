
-- Table for gamification XP events
CREATE TABLE public.user_xp (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  project_id uuid REFERENCES public.projects(id),
  action text NOT NULL,
  xp integer NOT NULL DEFAULT 0,
  metadata jsonb DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.user_xp ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own xp" ON public.user_xp FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own xp" ON public.user_xp FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Leaderboard: all authenticated users can see aggregated xp via profiles
CREATE POLICY "All can view xp for leaderboard" ON public.user_xp FOR SELECT USING (true);

CREATE INDEX idx_user_xp_user ON public.user_xp(user_id);
CREATE INDEX idx_user_xp_project ON public.user_xp(project_id);
