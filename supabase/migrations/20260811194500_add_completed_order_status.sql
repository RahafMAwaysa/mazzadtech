-- Customer confirmation is the terminal step after delivery.
-- The enum must contain completed before confirm_order_receipt can set it.
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'completed';
