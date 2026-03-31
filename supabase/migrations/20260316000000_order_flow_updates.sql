
-- 1. Ensure fcm_token exists on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS fcm_token TEXT;

-- 2. Add preparation fields to orders for the 4-day requirement
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS pickup_ready_by timestamptz,
  ADD COLUMN IF NOT EXISTS picked_up_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivery_timer_started_at timestamptz;

-- 3. Update delivery_requests table if needed
-- (It already has status and expires_at)

-- 4. Function to auto-calculate pickup_ready_by (4 days after paid)
CREATE OR REPLACE FUNCTION set_pickup_deadline()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid') THEN
    NEW.pickup_ready_by = NOW() + interval '4 days';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_pickup_deadline ON public.orders;
CREATE TRIGGER trigger_set_pickup_deadline
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION set_pickup_deadline();

-- 5. Add notifications for offer and chat types if missing
-- (Already handled by conversations.type CHECK (type IN ('chat', 'offer')))

-- 6. Ensure notification_settings has all needed flags
-- (Already has general, email, message, payment, update)
-- We might want to add 'delivery_notifications' specifically if needed, 
-- but 'update_notifications' or 'general' can cover it.

-- 7. Add index for faster order filtering
CREATE INDEX IF NOT EXISTS idx_orders_buyer_id ON public.orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_seller_id ON public.orders(seller_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
