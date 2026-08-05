ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'received_from_supplier';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'in_transit';