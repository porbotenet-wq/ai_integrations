
CREATE TABLE public.calendar_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id),
  title TEXT NOT NULL,
  date DATE NOT NULL,
  end_date DATE,
  type TEXT NOT NULL DEFAULT 'deadline',
  description TEXT,
  is_done BOOLEAN NOT NULL DEFAULT false,
  priority TEXT DEFAULT 'medium',
  ref_1c TEXT,
  doc_type_1c TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_calendar_events" ON public.calendar_events FOR SELECT USING (true);
CREATE POLICY "auth_insert_calendar_events" ON public.calendar_events FOR INSERT WITH CHECK (true);
CREATE POLICY "auth_update_calendar_events" ON public.calendar_events FOR UPDATE USING (true);

CREATE INDEX idx_calendar_events_project_date ON public.calendar_events(project_id, date);
