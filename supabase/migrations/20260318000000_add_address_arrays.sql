-- Add array-based address columns to profiles
-- pickup_addresses: array of pickup address objects
-- delivery_addresses: array of delivery address objects
-- Each address object: { id, address, town_city, postcode, label, created_at, updated_at }

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS pickup_addresses JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS delivery_addresses JSONB DEFAULT '[]'::jsonb;

-- Migrate existing single-address fields into the new arrays (if they have data)
UPDATE profiles
SET pickup_addresses = jsonb_build_array(
  jsonb_build_object(
    'id', gen_random_uuid()::text,
    'address', collection_address->>'address',
    'town_city', collection_address->>'town_city',
    'postcode', collection_address->>'postcode',
    'label', 'Default',
    'created_at', NOW()
  )
)
WHERE collection_address IS NOT NULL
  AND collection_address->>'address' IS NOT NULL
  AND (pickup_addresses IS NULL OR pickup_addresses = '[]'::jsonb);

UPDATE profiles
SET delivery_addresses = jsonb_build_array(
  jsonb_build_object(
    'id', gen_random_uuid()::text,
    'address', delivery_address->>'address',
    'town_city', delivery_address->>'town_city',
    'postcode', delivery_address->>'postcode',
    'label', 'Default',
    'created_at', NOW()
  )
)
WHERE delivery_address IS NOT NULL
  AND delivery_address->>'address' IS NOT NULL
  AND (delivery_addresses IS NULL OR delivery_addresses = '[]'::jsonb);
