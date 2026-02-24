
-- Create projects table
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT,
  address TEXT,
  city TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  photo_url TEXT,
  
  -- Client / partner info
  client_name TEXT,
  client_inn TEXT,
  client_kpp TEXT,
  client_ogrn TEXT,
  client_legal_address TEXT,
  client_actual_address TEXT,
  client_bank TEXT,
  client_account TEXT,
  client_email TEXT,
  client_phone TEXT,
  client_director TEXT,
  
  -- Work type: nvf (НВФ) or spk (СПК) or both
  work_type TEXT NOT NULL DEFAULT 'spk',
  
  -- Period
  start_date DATE,
  end_date DATE,
  duration_days INTEGER,
  
  -- Contacts / communication
  contacts JSONB DEFAULT '[]'::jsonb,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'draft',
  
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_projects" ON public.projects FOR SELECT USING (true);
CREATE POLICY "pm_manage_projects" ON public.projects FOR ALL 
  USING (has_role(auth.uid(), 'pm'::app_role) OR has_role(auth.uid(), 'director'::app_role));

-- Link existing tables to projects
ALTER TABLE public.facades ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id);
ALTER TABLE public.ecosystem_tasks ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id);
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id);
ALTER TABLE public.crews ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id);
ALTER TABLE public.work_types ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id);
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id);
ALTER TABLE public.plan_fact ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id);
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id);

-- Trigger for updated_at
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes
CREATE INDEX idx_facades_project ON public.facades(project_id);
CREATE INDEX idx_tasks_project ON public.ecosystem_tasks(project_id);
CREATE INDEX idx_materials_project ON public.materials(project_id);
CREATE INDEX idx_work_types_project ON public.work_types(project_id);

-- Insert СИТИ 4 as the first project
INSERT INTO public.projects (name, code, address, city, work_type, client_name, client_inn, client_director, client_phone, client_email, client_legal_address, client_actual_address, client_bank, client_account, status, contacts)
VALUES (
  'СИТИ 4 — Блок Б',
  'CITY4-B',
  'ММДЦ «Москва-Сити», участок №4',
  'Москва',
  'spk',
  'ООО «СФЕРА»',
  '1660339627',
  'Нигматуллин Артур Альбертович',
  '8 (960) 057 20 31',
  'info@gkpanorama.com',
  '420087, Республика Татарстан, город Казань, улица Аделя Кутуя, дом 86 корпус 3, офис 1',
  '420015, Республика Татарстан, город Казань, улица Касаткина, дом 15',
  'ООО "Банк Точка"',
  '40702810002500062202',
  'active',
  '[{"role":"Директор","name":"Нигматуллин А.А.","phone":"8 (960) 057 20 31"},{"role":"РП","name":"","phone":""},{"role":"Начальник участка","name":"","phone":""}]'
);
