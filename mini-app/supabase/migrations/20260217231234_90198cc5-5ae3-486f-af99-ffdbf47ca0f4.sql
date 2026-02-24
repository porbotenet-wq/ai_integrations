
-- Таблица попыток прохождения квиза
CREATE TABLE public.onboarding_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL,
  attempt_number integer NOT NULL DEFAULT 1,
  score integer NOT NULL,
  total integer NOT NULL DEFAULT 4,
  passed boolean NOT NULL,
  answers jsonb,
  read_seconds integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_onboarding_user ON public.onboarding_attempts(user_id);
CREATE INDEX idx_onboarding_role ON public.onboarding_attempts(role);

ALTER TABLE public.onboarding_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_own_attempts" ON public.onboarding_attempts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_insert_attempts" ON public.onboarding_attempts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "pm_director_read_attempts" ON public.onboarding_attempts
  FOR SELECT USING (
    has_role(auth.uid(), 'pm'::app_role) OR
    has_role(auth.uid(), 'director'::app_role)
  );

-- Статус онбординга в профиле
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS onboarding_attempts_count integer NOT NULL DEFAULT 0;

-- Функция: записать попытку и обновить профиль
CREATE OR REPLACE FUNCTION public.record_onboarding_attempt(
  p_role text,
  p_score integer,
  p_total integer,
  p_passed boolean,
  p_answers jsonb,
  p_read_seconds integer
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempt_number integer;
  v_attempt_id uuid;
BEGIN
  SELECT COALESCE(MAX(attempt_number), 0) + 1
    INTO v_attempt_number
    FROM public.onboarding_attempts
    WHERE user_id = auth.uid() AND role = p_role;

  INSERT INTO public.onboarding_attempts
    (user_id, role, attempt_number, score, total, passed, answers, read_seconds)
  VALUES
    (auth.uid(), p_role, v_attempt_number, p_score, p_total, p_passed, p_answers, p_read_seconds)
  RETURNING id INTO v_attempt_id;

  UPDATE public.profiles
    SET onboarding_attempts_count = onboarding_attempts_count + 1
    WHERE user_id = auth.uid();

  IF p_passed THEN
    UPDATE public.profiles
      SET onboarding_completed = true,
          onboarding_completed_at = now()
      WHERE user_id = auth.uid();
  END IF;

  RETURN jsonb_build_object(
    'attempt_id', v_attempt_id,
    'attempt_number', v_attempt_number,
    'passed', p_passed
  );
END;
$$;

-- View для аналитики онбординга
CREATE OR REPLACE VIEW public.onboarding_analytics
WITH (security_invoker = on) AS
SELECT
  p.user_id,
  p.display_name,
  ur.role,
  p.onboarding_completed,
  p.onboarding_completed_at,
  p.onboarding_attempts_count,
  (SELECT MAX(score) FROM public.onboarding_attempts oa WHERE oa.user_id = p.user_id) AS best_score,
  (SELECT AVG(read_seconds) FROM public.onboarding_attempts oa WHERE oa.user_id = p.user_id)::integer AS avg_read_seconds
FROM public.profiles p
LEFT JOIN public.user_roles ur ON ur.user_id = p.user_id;
