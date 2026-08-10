-- Associates each order with the delivery location the customer picked (or
-- added) at checkout. Purely additive — does not touch delivery_locations
-- itself or any of its existing policies.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_location_id uuid REFERENCES public.delivery_locations(id);
