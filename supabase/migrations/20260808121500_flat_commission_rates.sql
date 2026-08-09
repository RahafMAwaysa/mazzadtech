-- =========================================================
-- Simplify commission model: flat platform-wide rates instead
-- of per-category overrides.
--   - Supplier commission: 5%
--   - Delivery company commission: 5%
--   - Customer commission: 2%
-- =========================================================

ALTER TABLE public.platform_settings
  ALTER COLUMN default_supplier_commission_pct SET DEFAULT 5,
  ALTER COLUMN default_customer_commission_pct SET DEFAULT 2,
  ADD COLUMN IF NOT EXISTS default_delivery_commission_pct numeric NOT NULL DEFAULT 5;

UPDATE public.platform_settings
SET default_supplier_commission_pct = 5,
    default_customer_commission_pct = 2,
    default_delivery_commission_pct = 5
WHERE id = true;

-- Categories no longer carry their own commission overrides — every
-- category now uses the single flat platform-wide rate.
ALTER TABLE public.categories
  DROP COLUMN IF EXISTS supplier_commission_pct,
  DROP COLUMN IF EXISTS customer_commission_pct;

-- Rates are now flat and category-independent. The _category argument is
-- kept (rather than dropped) so existing call sites don't need to change,
-- but it no longer affects the result.
CREATE OR REPLACE FUNCTION public.get_commission_rates(_category text DEFAULT NULL)
RETURNS TABLE (supplier_pct numeric, customer_pct numeric, delivery_pct numeric)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  defaults record;
BEGIN
  SELECT s.default_supplier_commission_pct, s.default_customer_commission_pct, s.default_delivery_commission_pct
    INTO defaults FROM public.platform_settings s WHERE s.id = true;

  RETURN QUERY SELECT
    defaults.default_supplier_commission_pct,
    defaults.default_customer_commission_pct,
    defaults.default_delivery_commission_pct;
END;
$$;
