
-- Create document_folders table with hierarchy
CREATE TABLE public.document_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.document_folders(id) ON DELETE CASCADE,
  name text NOT NULL,
  department text NOT NULL,
  description text,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_doc_folders_project ON public.document_folders(project_id);
CREATE INDEX idx_doc_folders_parent ON public.document_folders(parent_id);

-- RLS
ALTER TABLE public.document_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_folders" ON public.document_folders FOR SELECT USING (true);

CREATE POLICY "pm_manage_folders" ON public.document_folders FOR ALL
  USING (has_role(auth.uid(), 'pm'::app_role) OR has_role(auth.uid(), 'director'::app_role));

-- Add folder_id to documents
ALTER TABLE public.documents ADD COLUMN folder_id uuid REFERENCES public.document_folders(id) ON DELETE SET NULL;
CREATE INDEX idx_documents_folder ON public.documents(folder_id);

-- Function to seed default folders for a project
CREATE OR REPLACE FUNCTION public.seed_project_folders(p_project_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_dept_id uuid;
  v_sub_id uuid;
BEGIN
  -- 1. Договорной отдел
  INSERT INTO document_folders (project_id, name, department, sort_order)
    VALUES (p_project_id, 'Договорной отдел', 'contract', 1) RETURNING id INTO v_dept_id;
  INSERT INTO document_folders (project_id, parent_id, name, department, sort_order) VALUES
    (p_project_id, v_dept_id, 'Договоры', 'contract', 1),
    (p_project_id, v_dept_id, 'Сметы', 'contract', 2),
    (p_project_id, v_dept_id, 'Дополнительные соглашения', 'contract', 3),
    (p_project_id, v_dept_id, 'Акты выполненных работ', 'contract', 4),
    (p_project_id, v_dept_id, 'Счета на оплату', 'contract', 5);

  -- 2. РП (Руководитель проекта)
  INSERT INTO document_folders (project_id, name, department, sort_order)
    VALUES (p_project_id, 'РП', 'pm', 2) RETURNING id INTO v_dept_id;
  INSERT INTO document_folders (project_id, parent_id, name, department, sort_order) VALUES
    (p_project_id, v_dept_id, 'ГПР', 'pm', 1),
    (p_project_id, v_dept_id, 'Приёмка ГРО', 'pm', 2),
    (p_project_id, v_dept_id, 'Акт принятия плоскостей и участков', 'pm', 3),
    (p_project_id, v_dept_id, 'Согласование материалов', 'pm', 4),
    (p_project_id, v_dept_id, 'Протоколы совещаний', 'pm', 5),
    (p_project_id, v_dept_id, 'Переписка с заказчиком', 'pm', 6);

  -- 3. ПТО
  INSERT INTO document_folders (project_id, name, department, sort_order)
    VALUES (p_project_id, 'ПТО', 'pto', 3) RETURNING id INTO v_dept_id;
  INSERT INTO document_folders (project_id, parent_id, name, department, sort_order) VALUES
    (p_project_id, v_dept_id, 'КС-2', 'pto', 1),
    (p_project_id, v_dept_id, 'КС-3', 'pto', 2),
    (p_project_id, v_dept_id, 'Акты скрытых работ', 'pto', 3),
    (p_project_id, v_dept_id, 'Исполнительные схемы', 'pto', 4),
    (p_project_id, v_dept_id, 'Журналы работ', 'pto', 5),
    (p_project_id, v_dept_id, 'Сертификаты и паспорта', 'pto', 6);

  -- 4. Кладовщик
  INSERT INTO document_folders (project_id, name, department, sort_order)
    VALUES (p_project_id, 'Кладовщик', 'warehouse', 4) RETURNING id INTO v_dept_id;
  INSERT INTO document_folders (project_id, parent_id, name, department, sort_order) VALUES
    (p_project_id, v_dept_id, 'Накладные', 'warehouse', 1),
    (p_project_id, v_dept_id, 'Акты приёмки', 'warehouse', 2),
    (p_project_id, v_dept_id, 'Инвентаризация', 'warehouse', 3);

  -- 5. Производство
  INSERT INTO document_folders (project_id, name, department, sort_order)
    VALUES (p_project_id, 'Производство', 'production', 5) RETURNING id INTO v_dept_id;
  INSERT INTO document_folders (project_id, parent_id, name, department, sort_order) VALUES
    (p_project_id, v_dept_id, 'Поставки', 'production', 1),
    (p_project_id, v_dept_id, 'Наряд-задания', 'production', 2),
    (p_project_id, v_dept_id, 'Графики производства работ', 'production', 3),
    (p_project_id, v_dept_id, 'Фотоотчёты', 'production', 4);

  -- 6. Проектировщики
  INSERT INTO document_folders (project_id, name, department, sort_order)
    VALUES (p_project_id, 'Проектировщики', 'designers', 6) RETURNING id INTO v_dept_id;
  INSERT INTO document_folders (project_id, parent_id, name, department, sort_order) VALUES
    (p_project_id, v_dept_id, 'КМ', 'designers', 1),
    (p_project_id, v_dept_id, 'ОПР', 'designers', 2),
    (p_project_id, v_dept_id, 'Рабочие чертежи', 'designers', 3),
    (p_project_id, v_dept_id, 'Узлы и детали', 'designers', 4),
    (p_project_id, v_dept_id, 'Альбомы', 'designers', 5);

  -- 7. Снабжение
  INSERT INTO document_folders (project_id, name, department, sort_order)
    VALUES (p_project_id, 'Снабжение', 'supply', 7) RETURNING id INTO v_dept_id;
  INSERT INTO document_folders (project_id, parent_id, name, department, sort_order) VALUES
    (p_project_id, v_dept_id, 'Обеспечение от общего объёма', 'supply', 1),
    (p_project_id, v_dept_id, 'Спецификации', 'supply', 2),
    (p_project_id, v_dept_id, 'Счета поставщиков', 'supply', 3),
    (p_project_id, v_dept_id, 'Договоры с поставщиками', 'supply', 4);

  -- 8. Охрана труда (дополнительно)
  INSERT INTO document_folders (project_id, name, department, sort_order)
    VALUES (p_project_id, 'Охрана труда', 'safety', 8) RETURNING id INTO v_dept_id;
  INSERT INTO document_folders (project_id, parent_id, name, department, sort_order) VALUES
    (p_project_id, v_dept_id, 'Инструктажи', 'safety', 1),
    (p_project_id, v_dept_id, 'Журналы ОТ', 'safety', 2),
    (p_project_id, v_dept_id, 'Предписания', 'safety', 3);
END;
$$;
