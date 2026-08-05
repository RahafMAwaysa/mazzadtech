CREATE TABLE public.delivery_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  alias text NOT NULL DEFAULT ('DLV-' || upper(substr(md5(random()::text), 1, 4))),
  phone text,
  city text,
  active boolean NOT NULL DEFAULT true,
  completed_deliveries integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_companies TO authenticated;
GRANT ALL ON public.delivery_companies TO service_role;

ALTER TABLE public.delivery_companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "delivery_companies_read" ON public.delivery_companies
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "delivery_companies_insert_self" ON public.delivery_companies
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "delivery_companies_update" ON public.delivery_companies
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "delivery_companies_delete_admin" ON public.delivery_companies
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER delivery_companies_set_updated_at
  BEFORE UPDATE ON public.delivery_companies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  wanted text;
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'phone')
  ON CONFLICT (id) DO NOTHING;

  wanted := coalesce(NEW.raw_user_meta_data->>'role','customer');
  IF wanted NOT IN ('customer','supplier','delivery') THEN
    wanted := 'customer';
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, wanted::public.app_role)
  ON CONFLICT DO NOTHING;

  IF wanted = 'supplier' THEN
    INSERT INTO public.supplier_profiles (user_id, company_name, categories)
    VALUES (NEW.id, coalesce(NEW.raw_user_meta_data->>'company_name','New Supplier'), '{}')
    ON CONFLICT (user_id) DO NOTHING;
  ELSIF wanted = 'delivery' THEN
    INSERT INTO public.delivery_companies (user_id, company_name, phone)
    VALUES (
      NEW.id,
      coalesce(NEW.raw_user_meta_data->>'company_name','New Delivery Company'),
      NEW.raw_user_meta_data->>'phone'
    )
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;