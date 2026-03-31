-- Add iCarry shipment tracking fields to orders table
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS icarry_order_id TEXT,
  ADD COLUMN IF NOT EXISTS icarry_tracking_number TEXT,
  ADD COLUMN IF NOT EXISTS icarry_tracking_url TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_icarry_tracking ON orders(icarry_tracking_number) WHERE icarry_tracking_number IS NOT NULL;
