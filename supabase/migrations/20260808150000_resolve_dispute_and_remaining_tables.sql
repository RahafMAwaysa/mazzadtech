-- =========================================================
-- Completes the schema catch-up: a real dispute-resolution
-- function (matching the disputes table already added
-- earlier), plus the still-missing ratings, reports, and
-- transaction_contracts tables.
-- =========================================================

-- Track which admin resolved a dispute (the earlier migration didn't have this yet).
ALTER TABLE public.disputes
  ADD COLUMN IF NOT EXISTS resolved_by uuid REFERENCES auth.users(id);

-- Applies an admin's dispute resolution as a real platform action: refund
-- bookkeeping, deduct from the supplier's wallet, or suspend the supplier —
-- then marks the dispute resolved.
CREATE OR REPLACE FUNCTION public.resolve_dispute(
  _dispute_id uuid,
  _action text,
  _note text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d record;
  o record;
  wallet_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can resolve disputes';
  END IF;

  SELECT * INTO d FROM public.disputes WHERE id = _dispute_id;
  IF d IS NULL THEN
    RAISE EXCEPTION 'Dispute not found';
  END IF;

  SELECT * INTO o FROM public.orders WHERE id = d.order_id;

  IF _action = 'refund_customer' THEN
    -- The customer paid by card; actual money movement back to the card is
    -- outside this prototype, but the reversal is logged against the
    -- supplier's wallet ledger for bookkeeping and future settlement.
    SELECT id INTO wallet_id FROM public.wallets WHERE supplier_id = o.supplier_id;
    IF wallet_id IS NOT NULL THEN
      INSERT INTO public.wallet_transactions (wallet_id, order_id, type, amount, note)
      VALUES (wallet_id, o.id, 'withdrawal', o.amount - o.commission, 'Dispute refund reversal');
      UPDATE public.wallets SET balance = balance - (o.amount - o.commission), updated_at = now()
      WHERE id = wallet_id;
    END IF;

  ELSIF _action = 'deduct_supplier' THEN
    SELECT id INTO wallet_id FROM public.wallets WHERE supplier_id = o.supplier_id;
    IF wallet_id IS NOT NULL THEN
      UPDATE public.wallets SET balance = balance - o.commission, updated_at = now() WHERE id = wallet_id;
      INSERT INTO public.wallet_transactions (wallet_id, order_id, type, amount, note)
      VALUES (wallet_id, o.id, 'withdrawal', o.commission, 'Dispute penalty deduction');
    END IF;

  ELSIF _action = 'suspend_supplier' THEN
    UPDATE public.profiles SET suspended = true, suspension_reason = _note WHERE id = o.supplier_id;
  END IF;

  UPDATE public.disputes
  SET status = 'resolved', resolution_action = _action, resolution_note = _note,
      resolved_by = auth.uid(), resolved_at = now()
  WHERE id = _dispute_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_dispute(uuid, text, text) TO authenticated;

-- ---------------------------------------------------------
-- Ratings (both directions, always identity-masked in the UI)
-- ---------------------------------------------------------
CREATE TABLE public.ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  rater_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ratee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rater_role text NOT NULL CHECK (rater_role IN ('customer', 'supplier')),
  stars smallint NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, rater_role)
);

GRANT SELECT, INSERT ON public.ratings TO authenticated;
GRANT ALL ON public.ratings TO service_role;

ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ratings_read" ON public.ratings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "ratings_insert_own" ON public.ratings
  FOR INSERT TO authenticated
  WITH CHECK (
    rater_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id AND (o.customer_id = auth.uid() OR o.supplier_id = auth.uid())
    )
  );

-- ---------------------------------------------------------
-- Supplier ad-hoc report archive (schema only — no UI yet)
-- ---------------------------------------------------------
CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reports_owner" ON public.reports
  FOR ALL TO authenticated
  USING (supplier_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (supplier_id = auth.uid());

-- ---------------------------------------------------------
-- Transaction contracts (tamper-evident order receipts — schema only)
-- ---------------------------------------------------------
CREATE TABLE public.transaction_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.transaction_contracts TO authenticated;
GRANT ALL ON public.transaction_contracts TO service_role;

ALTER TABLE public.transaction_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transaction_contracts_read" ON public.transaction_contracts
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = transaction_contracts.order_id AND (o.customer_id = auth.uid() OR o.supplier_id = auth.uid())
    )
  );
