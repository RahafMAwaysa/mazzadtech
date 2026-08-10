-- Ensures every signed-in user can view and edit their own profile row.
-- Additive/defensive only — does not touch any existing policy, and existing
-- broader access (e.g. admin, delivery-courier read) already granted
-- elsewhere continues to work unchanged.
DROP POLICY IF EXISTS "profiles_self_select" ON public.profiles;
CREATE POLICY "profiles_self_select" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS "profiles_self_update" ON public.profiles;
CREATE POLICY "profiles_self_update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
