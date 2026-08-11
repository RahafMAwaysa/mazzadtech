-- Supplier ratings are customer-driven and only become available after delivery.
-- Keep supplier identities private from customers; customer reviewer names are
-- visible to other customers, while suppliers see "Verified Customer".

ALTER TABLE public.supplier_profiles
  ALTER COLUMN rating SET DEFAULT 0;

CREATE OR REPLACE FUNCTION public.refresh_supplier_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  supplier_user_id uuid;
BEGIN
  supplier_user_id := CASE
    WHEN TG_OP = 'DELETE' THEN OLD.ratee_id
    ELSE NEW.ratee_id
  END;

  IF (TG_OP = 'DELETE' AND OLD.rater_role = 'customer')
     OR (TG_OP <> 'DELETE' AND NEW.rater_role = 'customer') THEN
    UPDATE public.supplier_profiles
    SET rating = COALESCE((
      SELECT ROUND(AVG(r.stars)::numeric, 2)
      FROM public.ratings r
      WHERE r.ratee_id = supplier_user_id
        AND r.rater_role = 'customer'
    ), 0)
    WHERE user_id = supplier_user_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ratings_refresh_supplier_rating ON public.ratings;
CREATE TRIGGER ratings_refresh_supplier_rating
AFTER INSERT OR UPDATE OR DELETE ON public.ratings
FOR EACH ROW EXECUTE FUNCTION public.refresh_supplier_rating();

DROP POLICY IF EXISTS "ratings_insert_own" ON public.ratings;
CREATE POLICY "ratings_insert_own" ON public.ratings
  FOR INSERT TO authenticated
  WITH CHECK (
    rater_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.orders o
      WHERE o.id = order_id
        AND o.status = 'delivered'
        AND (
          (o.customer_id = auth.uid()
            AND rater_role = 'customer'
            AND ratee_id = o.supplier_id)
          OR
          (o.supplier_id = auth.uid()
            AND rater_role = 'supplier'
            AND ratee_id = o.customer_id)
        )
    )
  );

CREATE OR REPLACE FUNCTION public.get_supplier_reviews(_supplier_id uuid)
RETURNS TABLE (
  id uuid,
  stars smallint,
  comment text,
  created_at timestamptz,
  reviewer_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.id,
    r.stars,
    r.comment,
    r.created_at,
    CASE
      WHEN public.has_role(auth.uid(), 'supplier') THEN NULL
      ELSE p.full_name
    END AS reviewer_name
  FROM public.ratings r
  LEFT JOIN public.profiles p ON p.id = r.rater_id
  WHERE r.ratee_id = _supplier_id
    AND r.rater_role = 'customer'
  ORDER BY r.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_supplier_reviews(uuid) TO authenticated;

UPDATE public.supplier_profiles sp
SET rating = COALESCE((
  SELECT ROUND(AVG(r.stars)::numeric, 2)
  FROM public.ratings r
  WHERE r.ratee_id = sp.user_id
    AND r.rater_role = 'customer'
), 0);
