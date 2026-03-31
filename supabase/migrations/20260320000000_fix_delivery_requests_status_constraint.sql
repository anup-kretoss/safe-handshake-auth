-- Fix delivery_requests status check constraint to include 'rejected'
-- Drop the existing constraint (try both possible names)
ALTER TABLE delivery_requests DROP CONSTRAINT IF EXISTS delivery_requests_status_check;
ALTER TABLE delivery_requests DROP CONSTRAINT IF EXISTS delivery_requests_status_check1;

-- Recreate with all valid statuses including 'rejected'
ALTER TABLE delivery_requests
  ADD CONSTRAINT delivery_requests_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'cancelled'));
