-- Fix Database Schema - Apply All Missing Changes
-- Run this SQL in your Supabase SQL Editor

-- 1. Create locations table
CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  country TEXT DEFAULT 'UAE',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert UAE locations
INSERT INTO locations (name, country) VALUES
('Dubai', 'UAE'),
('Abu Dhabi', 'UAE'),
('Sharjah', 'UAE'),
('Ajman', 'UAE'),
('Ras Al Khaimah', 'UAE'),
('Fujairah', 'UAE'),
('Umm Al Quwain', 'UAE'),
('Al Ain', 'UAE'),
('Khor Fakkan', 'UAE'),
('Dibba', 'UAE')
ON CONFLICT (name) DO NOTHING;

-- 2. Create notification_settings table
CREATE TABLE IF NOT EXISTS notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  general_notifications BOOLEAN DEFAULT true,
  email_notifications BOOLEAN DEFAULT true,
  message_notifications BOOLEAN DEFAULT true,
  payment_notifications BOOLEAN DEFAULT true,
  update_notifications BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_notification_settings_user_id ON notification_settings(user_id);

-- Enable RLS
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;

-- 3. Add missing columns to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'super_admin'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_image TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS user_description TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS collection_address JSONB;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS delivery_address JSONB;

-- Remove old pickup_addresses column if it exists
ALTER TABLE profiles DROP COLUMN IF EXISTS pickup_addresses;

-- Create indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username) WHERE username IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_location_id ON profiles(location_id);

-- 4. Update existing profiles
UPDATE profiles 
SET full_name = TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''))
WHERE full_name IS NULL AND (first_name IS NOT NULL OR last_name IS NOT NULL);

-- 5. Create storage bucket for profile images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-images', 
  'profile-images', 
  true, 
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 6. Create storage policies
DROP POLICY IF EXISTS "Users can upload their own profile images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own profile images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own profile images" ON storage.objects;
DROP POLICY IF EXISTS "Profile images are publicly viewable" ON storage.objects;

CREATE POLICY "Users can upload their own profile images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'profile-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own profile images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'profile-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own profile images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'profile-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Profile images are publicly viewable"
ON storage.objects FOR SELECT
USING (bucket_id = 'profile-images');

-- 7. Create notification settings policies
DROP POLICY IF EXISTS "Users can view their own notification settings" ON notification_settings;
DROP POLICY IF EXISTS "Users can update their own notification settings" ON notification_settings;
DROP POLICY IF EXISTS "Users can insert their own notification settings" ON notification_settings;

CREATE POLICY "Users can view their own notification settings"
  ON notification_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notification settings"
  ON notification_settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notification settings"
  ON notification_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 8. Create functions and triggers
CREATE OR REPLACE FUNCTION create_notification_settings_for_user()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO notification_settings (user_id)
  VALUES (NEW.user_id)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_create_notification_settings ON profiles;
CREATE TRIGGER trigger_create_notification_settings
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_notification_settings_for_user();

-- 9. Create address validation function
CREATE OR REPLACE FUNCTION validate_address(address JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  IF jsonb_typeof(address) != 'object' THEN
    RETURN FALSE;
  END IF;
  
  IF NOT (
    address ? 'address' AND 
    address ? 'town_city' AND 
    address ? 'postcode' AND
    address->>'address' != '' AND
    address->>'town_city' != '' AND
    address->>'postcode' != ''
  ) THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$;

-- Add address validation constraints
ALTER TABLE profiles 
DROP CONSTRAINT IF EXISTS check_collection_address_format;
ALTER TABLE profiles 
ADD CONSTRAINT check_collection_address_format 
CHECK (collection_address IS NULL OR validate_address(collection_address));

ALTER TABLE profiles 
DROP CONSTRAINT IF EXISTS check_delivery_address_format;
ALTER TABLE profiles 
ADD CONSTRAINT check_delivery_address_format 
CHECK (delivery_address IS NULL OR validate_address(delivery_address));

-- 10. Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;