-- Adds safe, non-sensitive payment metadata to support a future real
-- payment-provider integration (e.g. Stripe): expiry, and a provider
-- token/reference. The full card number and CVV are — and must remain —
-- never stored anywhere in this schema.
ALTER TABLE public.payment_cards
  ADD COLUMN IF NOT EXISTS expiry_month smallint CHECK (expiry_month BETWEEN 1 AND 12),
  ADD COLUMN IF NOT EXISTS expiry_year smallint,
  ADD COLUMN IF NOT EXISTS provider_ref text;
