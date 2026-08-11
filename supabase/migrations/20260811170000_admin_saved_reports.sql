-- Admin saved reports
-- Keeps the existing supplier report archive intact while giving admins
-- their own persistent report ownership field.

ALTER TABLE public.reports
  ALTER COLUMN supplier_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS admin_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS reports_admin_id_idx ON public.reports(admin_id);

DROP POLICY IF EXISTS "reports_admin_read" ON public.reports;
DROP POLICY IF EXISTS "reports_admin_insert" ON public.reports;
DROP POLICY IF EXISTS "reports_admin_delete" ON public.reports;

CREATE POLICY "reports_admin_read" ON public.reports
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND admin_id = auth.uid());

CREATE POLICY "reports_admin_insert" ON public.reports
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND admin_id = auth.uid());

CREATE POLICY "reports_admin_delete" ON public.reports
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND admin_id = auth.uid());
