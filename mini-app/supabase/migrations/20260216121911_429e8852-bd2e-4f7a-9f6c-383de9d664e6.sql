
-- Роли пользователей
CREATE TYPE public.app_role AS ENUM ('director', 'pm', 'project', 'supply', 'production', 'foreman1', 'foreman2', 'foreman3', 'pto', 'inspector');

-- Профили пользователей
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Таблица ролей
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- Фасады
CREATE TABLE public.facades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  total_modules INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.facades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read facades" ON public.facades FOR SELECT TO authenticated USING (true);
CREATE POLICY "Directors can manage facades" ON public.facades FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'director'));

-- Этажи
CREATE TABLE public.floors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facade_id UUID REFERENCES public.facades(id) ON DELETE CASCADE NOT NULL,
  floor_number INT NOT NULL,
  modules_plan INT NOT NULL DEFAULT 0,
  modules_fact INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.floors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read floors" ON public.floors FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can update floors" ON public.floors FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can insert floors" ON public.floors FOR INSERT TO authenticated WITH CHECK (true);

-- Работы (виды работ)
CREATE TABLE public.work_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);

ALTER TABLE public.work_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read work_types" ON public.work_types FOR SELECT TO authenticated USING (true);

-- План-факт данные
CREATE TABLE public.plan_fact (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_type_id UUID REFERENCES public.work_types(id) NOT NULL,
  facade_id UUID REFERENCES public.facades(id),
  floor_id UUID REFERENCES public.floors(id),
  week_number INT NOT NULL,
  date DATE NOT NULL,
  plan_value NUMERIC NOT NULL DEFAULT 0,
  fact_value NUMERIC NOT NULL DEFAULT 0,
  reported_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.plan_fact ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read plan_fact" ON public.plan_fact FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert plan_fact" ON public.plan_fact FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update plan_fact" ON public.plan_fact FOR UPDATE TO authenticated USING (true);

-- Бригады
CREATE TABLE public.crews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  foreman TEXT,
  specialization TEXT,
  headcount INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.crews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read crews" ON public.crews FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage crews" ON public.crews FOR ALL TO authenticated USING (true);

-- Назначения бригад
CREATE TABLE public.crew_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id UUID REFERENCES public.crews(id) ON DELETE CASCADE NOT NULL,
  facade_id UUID REFERENCES public.facades(id),
  floor_id UUID REFERENCES public.floors(id),
  work_type_id UUID REFERENCES public.work_types(id),
  date DATE NOT NULL,
  workers_count INT NOT NULL DEFAULT 0,
  output_value NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.crew_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read assignments" ON public.crew_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage assignments" ON public.crew_assignments FOR ALL TO authenticated USING (true);

-- Снабжение (материалы)
CREATE TABLE public.materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  total_required NUMERIC NOT NULL DEFAULT 0,
  in_stock NUMERIC NOT NULL DEFAULT 0,
  in_transit NUMERIC NOT NULL DEFAULT 0,
  deficit NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'normal',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read materials" ON public.materials FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage materials" ON public.materials FOR ALL TO authenticated USING (true);

-- Поставки
CREATE TABLE public.shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID REFERENCES public.materials(id) NOT NULL,
  quantity NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned',
  eta TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read shipments" ON public.shipments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage shipments" ON public.shipments FOR ALL TO authenticated USING (true);

-- ГПР (график производства работ)
CREATE TABLE public.gpr_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  facade_id UUID REFERENCES public.facades(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  progress NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'planned',
  parent_id UUID REFERENCES public.gpr_tasks(id),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.gpr_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read gpr_tasks" ON public.gpr_tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage gpr_tasks" ON public.gpr_tasks FOR ALL TO authenticated USING (true);

-- Алерты
CREATE TABLE public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'info',
  priority TEXT NOT NULL DEFAULT 'normal',
  facade_id UUID REFERENCES public.facades(id),
  floor_id UUID REFERENCES public.floors(id),
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read alerts" ON public.alerts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can create alerts" ON public.alerts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update alerts" ON public.alerts FOR UPDATE TO authenticated USING (true);

-- Документы (для ИИ-анализа)
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'pdf',
  parsed_text TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read documents" ON public.documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can upload documents" ON public.documents FOR INSERT TO authenticated WITH CHECK (true);

-- Google Sheets синхронизация
CREATE TABLE public.sync_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_id TEXT NOT NULL,
  sheet_name TEXT NOT NULL,
  target_table TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'bidirectional',
  last_synced_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sync_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Directors can manage sync" ON public.sync_config FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'director'));
CREATE POLICY "Authenticated can read sync" ON public.sync_config FOR SELECT TO authenticated USING (true);

-- Триггер для updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_floors_updated_at BEFORE UPDATE ON public.floors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_plan_fact_updated_at BEFORE UPDATE ON public.plan_fact FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_materials_updated_at BEFORE UPDATE ON public.materials FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_gpr_tasks_updated_at BEFORE UPDATE ON public.gpr_tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Начальные данные: виды работ
INSERT INTO public.work_types (name, unit, sort_order) VALUES
  ('Бурение Ø12', 'шт', 1),
  ('Бурение Ø16', 'шт', 2),
  ('Кронштейны Н', 'компл', 3),
  ('Кронштейны В', 'компл', 4),
  ('Модули СПК', 'шт', 5),
  ('Уплотнитель', 'м.п.', 6),
  ('Герметизация', 'м.п.', 7);

-- Начальные данные: фасады
INSERT INTO public.facades (name, total_modules) VALUES
  ('Фасад 1', 885),
  ('Фасад 2', 25),
  ('Фасад 3', 338),
  ('Углы', 68);

-- Реалтайм для ключевых таблиц
ALTER PUBLICATION supabase_realtime ADD TABLE public.plan_fact;
ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.materials;
