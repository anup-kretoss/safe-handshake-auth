-- Drop check constraints that enforce single-object format on address columns
-- so we can store arrays of addresses instead
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS check_collection_address_format;
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS check_delivery_address_format;
