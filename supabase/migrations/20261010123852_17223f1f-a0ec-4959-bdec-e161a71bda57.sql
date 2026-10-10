CREATE TABLE public.delivery_tracking (
  order_id uuid PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
  lat double precision,
  lng double precision,
  accuracy double precision,
  eta_at timestamptz,
  sharing boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.delivery_tracking TO authenticated;
GRANT ALL ON public.delivery_tracking TO service_role;
ALTER TABLE public.delivery_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY tracking_read ON public.delivery_tracking FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.is_order_courier(order_id, auth.uid())
  OR EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.customer_id = auth.uid())
);
CREATE POLICY tracking_courier_insert ON public.delivery_tracking FOR INSERT TO authenticated
WITH CHECK (public.is_order_courier(order_id, auth.uid()));
CREATE POLICY tracking_courier_update ON public.delivery_tracking FOR UPDATE TO authenticated
USING (public.is_order_courier(order_id, auth.uid()))
WITH CHECK (public.is_order_courier(order_id, auth.uid()));

CREATE TRIGGER delivery_tracking_set_updated_at BEFORE UPDATE ON public.delivery_tracking
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.delivery_tracking REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_tracking;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;