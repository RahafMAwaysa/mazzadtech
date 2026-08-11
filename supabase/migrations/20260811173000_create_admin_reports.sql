-- Dedicated admin reporting storage.
-- Intentionally separate from public.reports, which belongs to supplier reports.
CREATE TABLE IF NOT EXISTS public.admin_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  report_types text[] NOT NULL DEFAULT '{}',
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  selected_fields text[] NOT NULL DEFAULT '{}',
  report_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_reports_admin_id_idx ON public.admin_reports(admin_id);
CREATE INDEX IF NOT EXISTS admin_reports_created_at_idx ON public.admin_reports(created_at DESC);

ALTER TABLE public.admin_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_reports_read_own" ON public.admin_reports;
DROP POLICY IF EXISTS "admin_reports_insert_own" ON public.admin_reports;
DROP POLICY IF EXISTS "admin_reports_delete_own" ON public.admin_reports;

CREATE POLICY "admin_reports_read_own"
ON public.admin_reports
FOR SELECT TO authenticated
USING (admin_id = auth.uid() AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_reports_insert_own"
ON public.admin_reports
FOR INSERT TO authenticated
WITH CHECK (admin_id = auth.uid() AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_reports_delete_own"
ON public.admin_reports
FOR DELETE TO authenticated
USING (admin_id = auth.uid() AND public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.set_admin_reports_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS admin_reports_set_updated_at ON public.admin_reports;
CREATE TRIGGER admin_reports_set_updated_at
BEFORE UPDATE ON public.admin_reports
FOR EACH ROW EXECUTE FUNCTION public.set_admin_reports_updated_at();
