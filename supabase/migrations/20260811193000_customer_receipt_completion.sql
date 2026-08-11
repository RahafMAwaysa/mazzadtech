-- Customer confirmation is the final step after delivery.
-- Delivery partners can mark an order as delivered, but only the customer
-- can move it to completed and release the supplier payout.

ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'completed';

CREATE OR REPLACE FUNCTION public.credit_supplier_wallet(
  _supplier_id uuid,
  _amount numeric,
  _order_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  wallet_id uuid;
  order_status public.order_status;
BEGIN
  SELECT status INTO order_status
  FROM public.orders
  WHERE id = _order_id;

  -- Checkout currently calls this function when the order is created.
  -- Do not release supplier funds until the customer confirms receipt.
  IF order_status IS DISTINCT FROM 'completed'::public.order_status THEN
    RETURN;
  END IF;

  -- Idempotency: never pay the same order twice.
  IF EXISTS (
    SELECT 1
    FROM public.wallet_transactions wt
    JOIN public.wallets w ON w.id = wt.wallet_id
    WHERE wt.order_id = _order_id
      AND wt.type = 'credit'
      AND w.supplier_id = _supplier_id
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.wallets (supplier_id, balance)
  VALUES (_supplier_id, 0)
  ON CONFLICT (supplier_id) DO NOTHING;

  SELECT id INTO wallet_id
  FROM public.wallets
  WHERE supplier_id = _supplier_id;

  UPDATE public.wallets
  SET balance = balance + _amount, updated_at = now()
  WHERE id = wallet_id;

  INSERT INTO public.wallet_transactions (wallet_id, order_id, type, amount, note)
  VALUES (wallet_id, _order_id, 'credit', _amount, 'Order payout after customer confirmed receipt');
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_order_receipt(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o record;
BEGIN
  IF NOT public.has_role(auth.uid(), 'customer') THEN
    RAISE EXCEPTION 'Only customers can confirm receipt';
  END IF;

  SELECT * INTO o
  FROM public.orders
  WHERE id = _order_id
    AND customer_id = auth.uid();

  IF o IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF o.status = 'completed'::public.order_status THEN
    RETURN;
  END IF;

  IF o.status <> 'delivered'::public.order_status THEN
    RAISE EXCEPTION 'Order must be marked delivered before receipt can be confirmed';
  END IF;

  UPDATE public.orders
  SET status = 'completed'::public.order_status
  WHERE id = _order_id;

  INSERT INTO public.order_events (order_id, status)
  VALUES (_order_id, 'completed'::public.order_status);

  PERFORM public.credit_supplier_wallet(
    o.supplier_id,
    o.amount - o.commission,
    o.id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_order_receipt(uuid) TO authenticated;
