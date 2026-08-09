-- =========================================================
-- 1. Grant admin role to a specific email, if that account
--    already exists (they must have signed up at least once
--    through /auth first — this only attaches the role).
-- =========================================================
DO $$
DECLARE
  target_id uuid;
BEGIN
  SELECT id INTO target_id FROM auth.users WHERE email = 'backwalaa@gmail.com';

  IF target_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.user_roles WHERE user_id = target_id AND role = 'admin'
    ) THEN
      INSERT INTO public.user_roles (user_id, role) VALUES (target_id, 'admin');
    END IF;
  END IF;
END $$;

-- =========================================================
-- 2. Richer supplier verification status: pending / verified /
--    rejected, plus an admin-written note (e.g. "please upload
--    your trade license"). The existing boolean `verified`
--    column is kept in sync for any code that still reads it.
-- =========================================================
ALTER TABLE public.supplier_profiles
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN ('pending', 'verified', 'rejected')),
  ADD COLUMN IF NOT EXISTS verification_note text;

UPDATE public.supplier_profiles
SET verification_status = CASE WHEN verified THEN 'verified' ELSE 'pending' END;

CREATE OR REPLACE FUNCTION public.sync_supplier_verified()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.verified := (NEW.verification_status = 'verified');
  RETURN NEW;
END;
$$;

CREATE TRIGGER supplier_profiles_sync_verified
  BEFORE INSERT OR UPDATE OF verification_status ON public.supplier_profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_supplier_verified();
