-- =========================================================
-- Disputes: customer/supplier file a complaint tied to an
-- order; admin reviews and applies a resolution action.
-- =========================================================
CREATE TABLE public.disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  filed_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filed_by_role text NOT NULL CHECK (filed_by_role IN ('customer', 'supplier')),
  category text NOT NULL CHECK (
    category IN ('delivery_delay', 'product_mismatch', 'payment_issue', 'other')
  ),
  description text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  resolution_action text CHECK (
    resolution_action IN ('refund_customer', 'deduct_supplier', 'warn_supplier', 'suspend_supplier', 'no_action')
  ),
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

GRANT SELECT, INSERT ON public.disputes TO authenticated;
GRANT ALL ON public.disputes TO service_role;

ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

-- The filer and the order's other party can both see the dispute (each
-- knows it exists and its status), but never who exactly filed it beyond
-- what the app chooses to display; admin sees everything.
CREATE POLICY "disputes_participants_read" ON public.disputes
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR filed_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = disputes.order_id AND (o.customer_id = auth.uid() OR o.supplier_id = auth.uid())
    )
  );

CREATE POLICY "disputes_participant_file" ON public.disputes
  FOR INSERT TO authenticated
  WITH CHECK (
    filed_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id AND (o.customer_id = auth.uid() OR o.supplier_id = auth.uid())
    )
  );

CREATE POLICY "disputes_admin_update" ON public.disputes
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========================================================
-- Account suspension (applies to any role via profiles, since
-- profiles is the one table shared by every account type).
-- =========================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS suspended boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suspension_reason text;

-- Admin needs to read/update every profile for the Users screen; everyone
-- can already read/update their own profile via existing policies.
CREATE POLICY "profiles_admin_read_all" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "profiles_admin_update_all" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
