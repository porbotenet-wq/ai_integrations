
-- Добавить недостающие поля
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS supplier_code_1c TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS created_by UUID;

-- Добавить недостающее поле в materials
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS supplier_code_1c TEXT;

-- Дополнительные индексы
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_delivery ON public.orders(expected_delivery);
CREATE INDEX IF NOT EXISTS idx_orders_1c ON public.orders(order_number_1c) WHERE order_number_1c IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cal_type ON public.calendar_events(type);
CREATE INDEX IF NOT EXISTS idx_cal_1c ON public.calendar_events(ref_1c) WHERE ref_1c IS NOT NULL;

-- Триггер updated_at для orders
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- View: ближайшие события
CREATE OR REPLACE VIEW public.upcoming_events AS
SELECT
  ce.id, ce.project_id, ce.title, ce.date, ce.type, ce.is_done, ce.ref_1c,
  p.name AS project_name,
  (ce.date - CURRENT_DATE) AS days_until
FROM public.calendar_events ce
JOIN public.projects p ON p.id = ce.project_id
WHERE ce.date >= CURRENT_DATE AND ce.is_done = FALSE
ORDER BY ce.date ASC;

-- View: просроченные события
CREATE OR REPLACE VIEW public.overdue_events AS
SELECT
  ce.*, p.name AS project_name,
  (CURRENT_DATE - ce.date) AS days_overdue
FROM public.calendar_events ce
JOIN public.projects p ON p.id = ce.project_id
WHERE ce.date < CURRENT_DATE AND ce.is_done = FALSE
ORDER BY ce.date ASC;

-- Комментарии
COMMENT ON TABLE public.orders IS 'Заказы поставщикам — совместимо с 1С (order_number_1c, supplier_inn, supplier_code_1c)';
COMMENT ON TABLE public.calendar_events IS 'Календарные события проекта — дедлайны, поставки, выезды, оплаты';
