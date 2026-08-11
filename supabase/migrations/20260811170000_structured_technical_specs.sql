-- Structured technical specifications shared between customer requests and supplier offers.
ALTER TABLE public.purchase_requests
  ADD COLUMN IF NOT EXISTS technical_specs jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS technical_specs jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS offers_technical_specs_gin_idx
  ON public.offers USING gin (technical_specs);
