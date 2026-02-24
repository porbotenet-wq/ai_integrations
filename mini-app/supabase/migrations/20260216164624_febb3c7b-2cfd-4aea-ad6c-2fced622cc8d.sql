
-- Add ТБ (Техника безопасности) department folders via updating seed function
CREATE OR REPLACE FUNCTION public.seed_project_folders(p_project_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_dept_id uuid;
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

  -- 2. РП
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

  -- 8. Охрана труда
  INSERT INTO document_folders (project_id, name, department, sort_order)
    VALUES (p_project_id, 'Охрана труда', 'safety', 8) RETURNING id INTO v_dept_id;
  INSERT INTO document_folders (project_id, parent_id, name, department, sort_order) VALUES
    (p_project_id, v_dept_id, 'Инструктажи', 'safety', 1),
    (p_project_id, v_dept_id, 'Журналы ОТ', 'safety', 2),
    (p_project_id, v_dept_id, 'Предписания', 'safety', 3);

  -- 9. ТБ (Техника безопасности)
  INSERT INTO document_folders (project_id, name, department, sort_order)
    VALUES (p_project_id, 'ТБ', 'tb', 9) RETURNING id INTO v_dept_id;
  INSERT INTO document_folders (project_id, parent_id, name, department, sort_order) VALUES
    (p_project_id, v_dept_id, 'Удостоверения и корочки', 'tb', 1),
    (p_project_id, v_dept_id, 'Разрешения', 'tb', 2),
    (p_project_id, v_dept_id, 'ППР (проект производства работ)', 'tb', 3),
    (p_project_id, v_dept_id, 'Допуски', 'tb', 4),
    (p_project_id, v_dept_id, 'Наряд-допуски', 'tb', 5),
    (p_project_id, v_dept_id, 'Аттестации и обучение', 'tb', 6),
    (p_project_id, v_dept_id, 'Медосмотры', 'tb', 7);
END;
$$;
