-- Flat delivery fee (in NIS) added to every order. The platform keeps
-- default_delivery_commission_pct of this as its cut; the rest is what the
-- delivery company is owed, tracked for the monthly settlement invoice
-- (no live wallet for delivery companies per the simplified delivery flow).
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_fee numeric NOT NULL DEFAULT 20;
