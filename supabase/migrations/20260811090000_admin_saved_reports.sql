-- Persist admin-generated reports separately from supplier report archives.
CREATE TABLE IF NOT EXISTS public.admin_saved_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_saved_reports_admin_id_created_at_idx
  ON public.admin_saved_reports (admin_id, created_at DESC);

ALTER TABLE public.admin_saved_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_saved_reports_owner_read" ON public.admin_saved_reports;
CREATE POLICY "admin_saved_reports_owner_read"
ON public.admin_saved_reports
FOR SELECT TO authenticated
USING (admin_id = auth.uid() AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admin_saved_reports_owner_insert" ON public.admin_saved_reports;
CREATE POLICY "admin_saved_reports_owner_insert"
ON public.admin_saved_reports
FOR INSERT TO authenticated
WITH CHECK (admin_id = auth.uid() AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admin_saved_reports_owner_delete" ON public.admin_saved_reports;
CREATE POLICY "admin_saved_reports_owner_delete"
ON public.admin_saved_reports
FOR DELETE TO authenticated
USING (admin_id = auth.uid() AND public.has_role(auth.uid(), 'admin'));

GRANT SELECT, INSERT, DELETE ON public.admin_saved_reports TO authenticated;
GRANT ALL ON public.admin_saved_reports TO service_role;
