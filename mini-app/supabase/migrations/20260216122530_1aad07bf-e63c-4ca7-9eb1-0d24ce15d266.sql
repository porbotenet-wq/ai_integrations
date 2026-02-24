
-- Удаляем старые таблицы которые не соответствуют реальной структуре
DROP TABLE IF EXISTS public.crew_assignments CASCADE;
DROP TABLE IF EXISTS public.gpr_tasks CASCADE;
DROP TABLE IF EXISTS public.plan_fact CASCADE;
DROP TABLE IF EXISTS public.shipments CASCADE;
DROP TABLE IF EXISTS public.materials CASCADE;
DROP TABLE IF EXISTS public.floors CASCADE;
DROP TABLE IF EXISTS public.work_types CASCADE;
DROP TABLE IF EXISTS public.crews CASCADE;
DROP TABLE IF EXISTS public.alerts CASCADE;
DROP TABLE IF EXISTS public.documents CASCADE;
DROP TABLE IF EXISTS public.sync_config CASCADE;
DROP TABLE IF EXISTS public.facades CASCADE;

-- ==========================================
-- 1. ФАСАДЫ (основа проекта)
-- ==========================================
CREATE TABLE public.facades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT,
  axes TEXT, -- оси (Л/12-1, И/1-12 и т.д.)
  total_modules INT NOT NULL DEFAULT 0,
  floors_count INT NOT NULL DEFAULT 17,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.facades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_facades" ON public.facades FOR SELECT TO authenticated USING (true);
CREATE POLICY "directors_manage_facades" ON public.facades FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'director'));

INSERT INTO public.facades (name, code, axes, total_modules, floors_count) VALUES
  ('Фасад 1', 'F1', 'Л/12-1', 1003, 17),
  ('Фасад 2', 'F2', 'И/1-12', 674, 17),
  ('Углы 1-2', 'U12', NULL, 68, 17),
  ('Углы 3-4', 'U34', NULL, 68, 17);

-- ==========================================
-- 2. ЭТАЖИ с привязкой к фасаду
-- ==========================================
CREATE TABLE public.floors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facade_id UUID REFERENCES public.facades(id) ON DELETE CASCADE NOT NULL,
  floor_number INT NOT NULL,
  elevation TEXT, -- отметка (+15.900, +19.950 и т.д.)
  module_type TEXT, -- тип модуля (МР-2.1-1, МР-4.1-1...)
  module_width NUMERIC, -- 1460.1
  module_height NUMERIC, -- 4050, 6000, 6300
  modules_plan INT NOT NULL DEFAULT 0,
  modules_fact INT NOT NULL DEFAULT 0,
  brackets_plan INT NOT NULL DEFAULT 0,
  brackets_fact INT NOT NULL DEFAULT 0,
  sealant_plan NUMERIC NOT NULL DEFAULT 0,
  sealant_fact NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.floors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_floors" ON public.floors FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_update_floors" ON public.floors FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(), 'foreman1') OR public.has_role(auth.uid(), 'foreman2') OR 
  public.has_role(auth.uid(), 'foreman3') OR public.has_role(auth.uid(), 'pm') OR 
  public.has_role(auth.uid(), 'director')
);
CREATE POLICY "auth_insert_floors" ON public.floors FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(), 'pm') OR public.has_role(auth.uid(), 'director')
);

-- ==========================================
-- 3. ЭКОСИСТЕМА ЗАДАЧ (главная таблица)
-- ==========================================
CREATE TABLE public.ecosystem_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_number INT NOT NULL,
  block TEXT NOT NULL, -- Административный, Проектный, Снабжение, Производство, СМР, ПТО, Технадзор
  department TEXT NOT NULL, -- Отдел
  code TEXT NOT NULL, -- DO-001, RP-001, KM-001...
  name TEXT NOT NULL, -- Наименование задачи
  responsible TEXT, -- Ответственный
  input_document TEXT, -- Входящий документ
  output_document TEXT, -- Исходящий документ
  recipient TEXT, -- Получатель
  duration_days INT DEFAULT 0,
  planned_date DATE,
  trigger_text TEXT, -- Триггер для бота
  notification_type TEXT, -- Тип уведомления (кому)
  dependency_ids TEXT, -- Зависимость от ID (через запятую)
  priority TEXT NOT NULL DEFAULT 'Средний', -- Критический, Высокий, Средний, По факту
  status TEXT NOT NULL DEFAULT 'Ожидание', -- Выполнено, В работе, Ожидание
  assigned_to UUID REFERENCES auth.users(id),
  facade_id UUID REFERENCES public.facades(id),
  progress NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ecosystem_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_tasks" ON public.ecosystem_tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_update_tasks" ON public.ecosystem_tasks FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(), 'pm') OR public.has_role(auth.uid(), 'director') OR auth.uid() = assigned_to
);
CREATE POLICY "auth_insert_tasks" ON public.ecosystem_tasks FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(), 'pm') OR public.has_role(auth.uid(), 'director')
);

-- ==========================================
-- 4. ВИДЫ РАБОТ (ГПР - график производства работ)
-- ==========================================
CREATE TABLE public.work_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section TEXT NOT NULL, -- НВФ, СПК, Модульное остекление...
  subsection TEXT, -- Подготовительные, Монтаж подконструкции...
  sort_number INT,
  name TEXT NOT NULL,
  volume NUMERIC,
  unit TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  duration_days INT,
  workers_count INT DEFAULT 0,
  facade_id UUID REFERENCES public.facades(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.work_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_work_types" ON public.work_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "pm_manage_work_types" ON public.work_types FOR ALL TO authenticated USING (
  public.has_role(auth.uid(), 'pm') OR public.has_role(auth.uid(), 'director')
);

-- ==========================================
-- 5. ПЛАН-ФАКТ (ежедневный ввод)
-- ==========================================
CREATE TABLE public.plan_fact (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_type_id UUID REFERENCES public.work_types(id),
  facade_id UUID REFERENCES public.facades(id),
  floor_id UUID REFERENCES public.floors(id),
  week_number INT NOT NULL,
  date DATE NOT NULL,
  plan_value NUMERIC NOT NULL DEFAULT 0,
  fact_value NUMERIC NOT NULL DEFAULT 0,
  reported_by UUID REFERENCES auth.users(id),
  crew_id UUID,
  notes TEXT,
  photo_urls TEXT[], -- массив ссылок на фото
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.plan_fact ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_pf" ON public.plan_fact FOR SELECT TO authenticated USING (true);
CREATE POLICY "workers_insert_pf" ON public.plan_fact FOR INSERT TO authenticated WITH CHECK (auth.uid() = reported_by);
CREATE POLICY "workers_update_pf" ON public.plan_fact FOR UPDATE TO authenticated USING (
  auth.uid() = reported_by OR public.has_role(auth.uid(), 'pm') OR public.has_role(auth.uid(), 'director')
);

-- ==========================================
-- 6. БРИГАДЫ
-- ==========================================
CREATE TABLE public.crews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  foreman_name TEXT,
  foreman_user_id UUID REFERENCES auth.users(id),
  specialization TEXT,
  headcount INT NOT NULL DEFAULT 0,
  facade_id UUID REFERENCES public.facades(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.crews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_crews" ON public.crews FOR SELECT TO authenticated USING (true);
CREATE POLICY "pm_manage_crews" ON public.crews FOR ALL TO authenticated USING (
  public.has_role(auth.uid(), 'pm') OR public.has_role(auth.uid(), 'director')
);

-- ==========================================
-- 7. МАТЕРИАЛЫ И СНАБЖЕНИЕ
-- ==========================================
CREATE TABLE public.materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  category TEXT, -- СПК, Каркас, Герметика, Кронштейны...
  total_required NUMERIC NOT NULL DEFAULT 0,
  ordered NUMERIC NOT NULL DEFAULT 0,
  in_production NUMERIC NOT NULL DEFAULT 0,
  shipped NUMERIC NOT NULL DEFAULT 0,
  on_site NUMERIC NOT NULL DEFAULT 0,
  installed NUMERIC NOT NULL DEFAULT 0,
  deficit NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'normal',
  supplier TEXT,
  order_date DATE,
  eta DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_materials" ON public.materials FOR SELECT TO authenticated USING (true);
CREATE POLICY "supply_manage_materials" ON public.materials FOR ALL TO authenticated USING (
  public.has_role(auth.uid(), 'supply') OR public.has_role(auth.uid(), 'pm') OR public.has_role(auth.uid(), 'director')
);

-- ==========================================
-- 8. ПОСТАВКИ (партии)
-- ==========================================
CREATE TABLE public.shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID REFERENCES public.materials(id) NOT NULL,
  batch_number TEXT,
  quantity NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned', -- planned, in_production, shipped, in_transit, received, inspected
  quality_status TEXT, -- ok, defect, partial
  defect_count INT DEFAULT 0,
  defect_notes TEXT,
  eta TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_shipments" ON public.shipments FOR SELECT TO authenticated USING (true);
CREATE POLICY "supply_manage_shipments" ON public.shipments FOR ALL TO authenticated USING (
  public.has_role(auth.uid(), 'supply') OR public.has_role(auth.uid(), 'pm') OR public.has_role(auth.uid(), 'director')
);

-- ==========================================
-- 9. АЛЕРТЫ / УВЕДОМЛЕНИЯ
-- ==========================================
CREATE TABLE public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'info', -- info, warning, danger, success
  priority TEXT NOT NULL DEFAULT 'normal', -- low, normal, high, critical
  category TEXT, -- delay, defect, supply, safety, trigger
  source_task_id UUID REFERENCES public.ecosystem_tasks(id),
  facade_id UUID REFERENCES public.facades(id),
  floor_number INT,
  target_roles app_role[],
  is_read BOOLEAN NOT NULL DEFAULT false,
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_alerts" ON public.alerts FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_alerts" ON public.alerts FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "auth_update_alerts" ON public.alerts FOR UPDATE TO authenticated USING (
  auth.uid() = created_by OR public.has_role(auth.uid(), 'pm') OR public.has_role(auth.uid(), 'director')
);

-- ==========================================
-- 10. ДОКУМЕНТЫ (ИИ-анализ)
-- ==========================================
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'pdf',
  file_size INT,
  parsed_text TEXT,
  ai_summary TEXT,
  category TEXT, -- drawing, spec, report, contract, photo
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_documents" ON public.documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_upload_documents" ON public.documents FOR INSERT TO authenticated WITH CHECK (auth.uid() = uploaded_by);

-- ==========================================
-- 11. СИНХРОНИЗАЦИЯ GOOGLE SHEETS
-- ==========================================
CREATE TABLE public.sync_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_id TEXT NOT NULL,
  sheet_name TEXT NOT NULL,
  target_table TEXT NOT NULL,
  column_mapping JSONB, -- маппинг колонок sheet -> db
  direction TEXT NOT NULL DEFAULT 'bidirectional',
  sync_interval_minutes INT DEFAULT 15,
  last_synced_at TIMESTAMPTZ,
  last_error TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sync_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "directors_manage_sync" ON public.sync_config FOR ALL TO authenticated USING (
  public.has_role(auth.uid(), 'director') OR public.has_role(auth.uid(), 'pm')
);
CREATE POLICY "auth_read_sync" ON public.sync_config FOR SELECT TO authenticated USING (true);

-- ==========================================
-- 12. ЧАТ С ИИ (история)
-- ==========================================
CREATE TABLE public.ai_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  document_id UUID REFERENCES public.documents(id),
  role TEXT NOT NULL, -- user, assistant
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_messages" ON public.ai_chat_messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_insert_messages" ON public.ai_chat_messages FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ==========================================
-- ТРИГГЕРЫ updated_at
-- ==========================================
CREATE TRIGGER update_floors_ts BEFORE UPDATE ON public.floors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tasks_ts BEFORE UPDATE ON public.ecosystem_tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_pf_ts BEFORE UPDATE ON public.plan_fact FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_materials_ts BEFORE UPDATE ON public.materials FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==========================================
-- РЕАЛТАЙМ
-- ==========================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.plan_fact;
ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ecosystem_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.materials;

-- ==========================================
-- НАЧАЛЬНЫЕ ДАННЫЕ: МАТЕРИАЛЫ ИЗ ДОГОВОРА
-- ==========================================
INSERT INTO public.materials (name, unit, category, total_required) VALUES
  ('Модули СПК', 'шт', 'СПК', 2486),
  ('Стеклопакеты', 'м2', 'СПК', 15647.62),
  ('Каркас СРС', 'м2', 'Каркас', 1760.08),
  ('Сэндвич-панели', 'м2', 'СПК', 5063.96),
  ('Утепление стены 1 этажа', 'м2', 'Утепление', 547.98),
  ('Верхнее примыкание', 'м.п.', 'Примыкание', 357.20),
  ('Нижнее примыкание', 'м.п.', 'Примыкание', 357.20),
  ('Межэтажное примыкание', 'м.п.', 'Примыкание', 3592.36),
  ('Герметизация швов (наружная)', 'м.п.', 'Герметика', 2836.01),
  ('Герметизация модулей (сборка)', 'м.п.', 'Герметика', 35686.68),
  ('Кронштейны несущие/ветровые', 'шт', 'Кронштейны', 265),
  ('Комплект крепления модулей', 'шт', 'Кронштейны', 2539),
  ('Крепление ветровых кронштейнов', 'шт', 'Кронштейны', 151),
  ('Ламели', 'шт', 'Декор', 2635),
  ('Двери алюминиевые', 'шт', 'Двери', 9),
  ('Карусельные двери', 'шт', 'Двери', 2),
  ('Двери ДН', 'шт', 'Двери', 6),
  ('Вентиляционные решетки', 'м2', 'Прочее', 56.72),
  ('Противопожарный пояс 3-4 этаж', 'м2', 'Пожарная', 256.80),
  ('Шумозащитные экраны', 'шт', 'Прочее', 119);
