-- Admin saved reports: extend the existing supplier report archive safely.
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS admin_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Admin reports are owned by the admin who created them. Supplier reports keep
-- their existing supplier ownership model.
DROP POLICY IF EXISTS "reports_owner" ON public.reports;

CREATE POLICY "reports_supplier_owner" ON public.reports
FOR ALL TO authenticated
USING (
  supplier_id = auth.uid()
  AND admin_id IS NULL
)
WITH CHECK (
  supplier_id = auth.uid()
  AND admin_id IS NULL
);

CREATE POLICY "reports_admin_owner" ON public.reports
FOR ALL TO authenticated
USING (
  admin_id = auth.uid()
  AND public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  admin_id = auth.uid()
  AND public.has_role(auth.uid(), 'admin')
);

CREATE INDEX IF NOT EXISTS reports_admin_id_created_at_idx
  ON public.reports (admin_id, created_at DESC);
