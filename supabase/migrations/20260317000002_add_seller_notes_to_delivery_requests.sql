-- Add seller_notes column to delivery_requests table
ALTER TABLE public.delivery_requests
  ADD COLUMN IF NOT EXISTS seller_notes TEXT;
