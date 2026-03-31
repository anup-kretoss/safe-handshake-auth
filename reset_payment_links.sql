-- Reset all orders stuck with old Mamo payment links
-- Run this in Supabase Dashboard → SQL Editor
UPDATE orders 
SET mamo_payment_link_id = NULL, 
    status = 'pending'
WHERE status IN ('pending_payment', 'pending')
  AND mamo_payment_link_id IS NOT NULL;
