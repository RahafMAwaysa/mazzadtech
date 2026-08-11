-- Optimize the customer offers page by fetching all supplier review counts in one RPC.
-- This replaces the per-supplier get_supplier_reviews() calls used only for counts.

CREATE OR REPLACE FUNCTION public.get_supplier_review_counts(_supplier_ids uuid[])
RETURNS TABLE (
  supplier_id uuid,
  review_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.ratee_id AS supplier_id,
    COUNT(*)::bigint AS review_count
  FROM public.ratings r
  WHERE r.rater_role = 'customer'
    AND r.ratee_id = ANY(_supplier_ids)
  GROUP BY r.ratee_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_supplier_review_counts(uuid[]) TO authenticated;
