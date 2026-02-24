
-- Таблица заказов (совместима с 1С)
CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id),
  order_number TEXT,
  order_number_1c TEXT,
  material_id UUID REFERENCES public.materials(id),
  material_name TEXT NOT NULL,
  supplier TEXT NOT NULL,
  supplier_inn TEXT,
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'шт',
  price_per_unit NUMERIC,
  total_amount NUMERIC,
  status TEXT NOT NULL DEFAULT 'draft',
  order_date DATE,
  expected_delivery DATE,
  actual_delivery DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_orders" ON public.orders FOR SELECT USING (true);
CREATE POLICY "supply_manage_orders" ON public.orders FOR ALL USING (
  has_role(auth.uid(), 'supply'::app_role) OR
  has_role(auth.uid(), 'pm'::app_role) OR
  has_role(auth.uid(), 'director'::app_role)
);

CREATE INDEX idx_orders_project ON public.orders(project_id);

-- Добавить поля 1С в materials
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS code_1c TEXT;
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS supplier_inn TEXT;
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS price_per_unit NUMERIC;
