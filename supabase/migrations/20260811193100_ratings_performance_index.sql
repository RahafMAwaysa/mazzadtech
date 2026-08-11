-- Ensure review lookups used by the offers page are indexed.
CREATE INDEX IF NOT EXISTS ratings_ratee_role_idx
  ON public.ratings (ratee_id, rater_role);
