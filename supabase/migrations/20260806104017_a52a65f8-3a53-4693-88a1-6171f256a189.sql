CREATE OR REPLACE FUNCTION public.is_courier_for_person(_person_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.orders o
    JOIN public.delivery_companies d ON d.id = o.delivery_company_id
    WHERE d.user_id = _user_id
      AND (o.customer_id = _person_id OR o.supplier_id = _person_id)
  )
$$;

REVOKE EXECUTE ON FUNCTION public.is_courier_for_person(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_courier_for_person(uuid, uuid) TO authenticated;

CREATE POLICY profiles_courier_read ON public.profiles
FOR SELECT TO authenticated
USING (public.is_courier_for_person(id, auth.uid()));
