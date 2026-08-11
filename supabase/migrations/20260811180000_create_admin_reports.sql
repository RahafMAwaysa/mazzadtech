-- Dedicated storage for administrator-generated reports.
-- Kept separate from public.reports, which is used by supplier report archives.

CREATE TABLE IF NOT EXISTS public.admin_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  report_types jsonb NOT NULL DEFAULT '[]'::jsonb,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  selected_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  report_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_reports_admin_id_idx ON public.admin_reports(admin_id);
CREATE INDEX IF NOT EXISTS admin_reports_created_at_idx ON public.admin_reports(created_at DESC);

ALTER TABLE public.admin_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_reports_select_own" ON public.admin_reports;
CREATE POLICY "admin_reports_select_own"
ON public.admin_reports
FOR SELECT TO authenticated
USING (admin_id = auth.uid() AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admin_reports_insert_own" ON public.admin_reports;
CREATE POLICY "admin_reports_insert_own"
ON public.admin_reports
FOR INSERT TO authenticated
WITH CHECK (admin_id = auth.uid() AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admin_reports_delete_own" ON public.admin_reports;
CREATE POLICY "admin_reports_delete_own"
ON public.admin_reports
FOR DELETE TO authenticated
USING (admin_id = auth.uid() AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admin_reports_update_own" ON public.admin_reports;
CREATE POLICY "admin_reports_update_own"
ON public.admin_reports
FOR UPDATE TO authenticated
USING (admin_id = auth.uid() AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (admin_id = auth.uid() AND public.has_role(auth.uid(), 'admin'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_reports TO authenticated;
GRANT ALL ON public.admin_reports TO service_role;

CREATE OR REPLACE FUNCTION public.set_admin_report_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS admin_reports_set_updated_at ON public.admin_reports;
CREATE TRIGGER admin_reports_set_updated_at
BEFORE UPDATE ON public.admin_reports
FOR EACH ROW EXECUTE FUNCTION public.set_admin_report_updated_at();

NOTIFY pgrst, 'reload schema';
