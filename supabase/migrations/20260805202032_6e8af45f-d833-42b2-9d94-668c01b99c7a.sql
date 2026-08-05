ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_company_id uuid REFERENCES public.delivery_companies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS orders_delivery_company_id_idx ON public.orders (delivery_company_id);

CREATE OR REPLACE FUNCTION public.is_order_courier(_order_id uuid, _user_id uuid)
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
    WHERE o.id = _order_id AND d.user_id = _user_id
  )
$$;

REVOKE ALL ON FUNCTION public.is_order_courier(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_order_courier(uuid, uuid) TO authenticated, service_role;

CREATE POLICY "orders_courier_read" ON public.orders
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.delivery_companies d
    WHERE d.id = orders.delivery_company_id AND d.user_id = auth.uid()
  ));

CREATE POLICY "orders_courier_update" ON public.orders
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.delivery_companies d
    WHERE d.id = orders.delivery_company_id AND d.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.delivery_companies d
    WHERE d.id = orders.delivery_company_id AND d.user_id = auth.uid()
  ));

CREATE POLICY "order_events_courier_read" ON public.order_events
  FOR SELECT TO authenticated
  USING (public.is_order_courier(order_events.order_id, auth.uid()));

CREATE POLICY "order_events_courier_insert" ON public.order_events
  FOR INSERT TO authenticated
  WITH CHECK (public.is_order_courier(order_events.order_id, auth.uid()));