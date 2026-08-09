-- Optional product video on supplier offers (not mandatory, per latest decision).
ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS video_url text;
