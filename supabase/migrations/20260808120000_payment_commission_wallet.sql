-- =========================================================
-- Payment phase: categories/commission, saved payment cards,
-- and automatic supplier wallet crediting.
-- =========================================================

-- ---------------------------------------------------------
-- 1. Platform-wide default commission settings (singleton row)
-- ---------------------------------------------------------
CREATE TABLE public.platform_settings (
  id boolean PRIMARY KEY DEFAULT true,
  default_supplier_commission_pct numeric NOT NULL DEFAULT 6,
  default_customer_commission_pct numeric NOT NULL DEFAULT 1.5,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_settings_singleton CHECK (id)
);

INSERT INTO public.platform_settings (id) VALUES (true);

GRANT SELECT ON public.platform_settings TO authenticated;
GRANT ALL ON public.platform_settings TO service_role;

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_settings_read" ON public.platform_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "platform_settings_admin_write" ON public.platform_settings
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------
-- 2. Categories with per-category commission overrides
-- ---------------------------------------------------------
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  name_ar text,
  supplier_commission_pct numeric,
  customer_commission_pct numeric,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.categories (name, name_ar, supplier_commission_pct, customer_commission_pct) VALUES
  ('Laptop', 'لابتوب', 7, 1.5),
  ('Mobile Devices', 'أجهزة موبايل', 5, 1),
  ('Smart Watch', 'ساعة ذكية', 5, 1),
  ('Projector', 'بروجكتر', 5, 1),
  ('Camera', 'كاميرا', 5, 1),
  ('Audio', 'صوتيات', 4, 1),
  ('Accessory', 'إكسسوارات', 4, 1);

GRANT SELECT ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "categories_read" ON public.categories
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "categories_admin_write" ON public.categories
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER categories_set_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Look up the commission rates for a category name, falling back to the
-- platform default whenever the category is missing or has a null override.
CREATE OR REPLACE FUNCTION public.get_commission_rates(_category text)
RETURNS TABLE (supplier_pct numeric, customer_pct numeric)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  cat record;
  defaults record;
BEGIN
  SELECT s.default_supplier_commission_pct, s.default_customer_commission_pct
    INTO defaults FROM public.platform_settings s WHERE s.id = true;

  SELECT c.supplier_commission_pct, c.customer_commission_pct
    INTO cat FROM public.categories c
    WHERE lower(c.name) = lower(_category) AND c.active
    LIMIT 1;

  RETURN QUERY SELECT
    coalesce(cat.supplier_commission_pct, defaults.default_supplier_commission_pct),
    coalesce(cat.customer_commission_pct, defaults.default_customer_commission_pct);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_commission_rates(text) TO authenticated;

-- ---------------------------------------------------------
-- 3. Saved payment cards (masked — last 4 digits only, no PAN ever stored)
-- ---------------------------------------------------------
CREATE TABLE public.payment_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand text NOT NULL DEFAULT 'card',
  last4 text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_cards TO authenticated;
GRANT ALL ON public.payment_cards TO service_role;

ALTER TABLE public.payment_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_cards_owner_read" ON public.payment_cards
  FOR SELECT TO authenticated
  USING (customer_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "payment_cards_owner_write" ON public.payment_cards
  FOR INSERT TO authenticated WITH CHECK (customer_id = auth.uid());

CREATE POLICY "payment_cards_owner_update" ON public.payment_cards
  FOR UPDATE TO authenticated
  USING (customer_id = auth.uid())
  WITH CHECK (customer_id = auth.uid());

CREATE POLICY "payment_cards_owner_delete" ON public.payment_cards
  FOR DELETE TO authenticated USING (customer_id = auth.uid());

-- ---------------------------------------------------------
-- 4. Supplier wallet + transaction ledger
-- ---------------------------------------------------------
CREATE TABLE public.wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  balance numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.wallets TO authenticated;
GRANT ALL ON public.wallets TO service_role;

ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wallets_owner_read" ON public.wallets
  FOR SELECT TO authenticated
  USING (supplier_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- No direct INSERT/UPDATE policy for suppliers or customers: balance only
-- ever changes through the SECURITY DEFINER functions below, so nobody
-- can credit or debit their own wallet by hand.

CREATE TABLE public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('credit', 'withdrawal')),
  amount numeric NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.wallet_transactions TO authenticated;
GRANT ALL ON public.wallet_transactions TO service_role;

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wallet_transactions_owner_read" ON public.wallet_transactions
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.wallets w
      WHERE w.id = wallet_transactions.wallet_id AND w.supplier_id = auth.uid()
    )
  );

-- Credits the supplier's wallet with the post-commission amount for a
-- completed electronic payment. Called right after an order is inserted.
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
BEGIN
  INSERT INTO public.wallets (supplier_id, balance)
  VALUES (_supplier_id, 0)
  ON CONFLICT (supplier_id) DO NOTHING;

  SELECT id INTO wallet_id FROM public.wallets WHERE supplier_id = _supplier_id;

  UPDATE public.wallets SET balance = balance + _amount, updated_at = now()
  WHERE id = wallet_id;

  INSERT INTO public.wallet_transactions (wallet_id, order_id, type, amount, note)
  VALUES (wallet_id, _order_id, 'credit', _amount, 'Order payout after commission');
END;
$$;

GRANT EXECUTE ON FUNCTION public.credit_supplier_wallet(uuid, numeric, uuid) TO authenticated;

-- Instant, self-service withdrawal: any authenticated supplier can withdraw
-- from their own wallet at any time (no admin approval needed), but every
-- withdrawal is permanently logged for dispute-proofing.
CREATE OR REPLACE FUNCTION public.withdraw_from_wallet(_amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  wallet_id uuid;
  current_balance numeric;
BEGIN
  SELECT id, balance INTO wallet_id, current_balance
  FROM public.wallets WHERE supplier_id = auth.uid();

  IF wallet_id IS NULL THEN
    RAISE EXCEPTION 'No wallet found for this account';
  END IF;

  IF _amount <= 0 OR _amount > current_balance THEN
    RAISE EXCEPTION 'Invalid withdrawal amount';
  END IF;

  UPDATE public.wallets SET balance = balance - _amount, updated_at = now()
  WHERE id = wallet_id;

  INSERT INTO public.wallet_transactions (wallet_id, type, amount, note)
  VALUES (wallet_id, 'withdrawal', _amount, 'Instant self-service withdrawal to bank');
END;
$$;

GRANT EXECUTE ON FUNCTION public.withdraw_from_wallet(numeric) TO authenticated;

-- ---------------------------------------------------------
-- 5. Orders: track supplier-side and customer-side commission separately
-- ---------------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customer_commission numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_card_id uuid REFERENCES public.payment_cards(id);
