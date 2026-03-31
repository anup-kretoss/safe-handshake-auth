-- Add Mamopay payment link tracking to orders
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS mamo_payment_link_id TEXT,
  ADD COLUMN IF NOT EXISTS mamo_transaction_id TEXT;

-- Allow 'pending_payment' as a valid order status
ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE orders
  ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending', 'pending_payment', 'approved', 'paid', 'shipped', 'delivered', 'cancelled'));
