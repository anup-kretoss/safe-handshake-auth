-- Complete Profile System with Enhanced Signup Requirements
-- This migration adds all required fields for mandatory signup

-- 1. Create locations table for dropdown options
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

-- Enable RLS
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;

-- 3. Add missing columns to profiles table (if they don't exist)
DO $$ 
BEGIN
  -- Add role column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'role') THEN
    ALTER TABLE profiles ADD COLUMN role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'super_admin'));
  END IF;

  -- Add profile_image column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'profile_image') THEN
    ALTER TABLE profiles ADD COLUMN profile_image TEXT;
  END IF;

  -- Add username column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'username') THEN
    ALTER TABLE profiles ADD COLUMN username TEXT;
  END IF;

  -- Add user_description column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'user_description') THEN
    ALTER TABLE profiles ADD COLUMN user_description TEXT;
  END IF;

  -- Add location_id column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'location_id') THEN
    ALTER TABLE profiles ADD COLUMN location_id UUID REFERENCES locations(id);
  END IF;

  -- Add full_name column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'full_name') THEN
    ALTER TABLE profiles ADD COLUMN full_name TEXT;
  END IF;

  -- Add collection_address column (REQUIRED at signup)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'collection_address') THEN
    ALTER TABLE profiles ADD COLUMN collection_address JSONB;
  END IF;

  -- Add delivery_address column (REQUIRED at signup)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'delivery_address') THEN
    ALTER TABLE profiles ADD COLUMN delivery_address JSONB;
  END IF;
END $$;

-- 4. Remove pickup_addresses column if it exists (replaced by collection_address and delivery_address)
ALTER TABLE profiles DROP COLUMN IF EXISTS pickup_addresses;

-- 5. Create indexes
CREATE INDEX IF NOT EXISTS idx_notification_settings_user_id ON notification_settings(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username) WHERE username IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_location_id ON profiles(location_id);

-- 7. Storage bucket for profile images (skip RLS as it's already enabled)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-images', 
  'profile-images', 
  true, 
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 8. Create storage policies
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

-- 9. Create notification settings policies
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

-- 10. Create function to validate address JSON structure
CREATE OR REPLACE FUNCTION validate_address(address JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if it's an object with required fields
  IF jsonb_typeof(address) != 'object' THEN
    RETURN FALSE;
  END IF;
  
  -- Check required fields
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

-- 11. Add constraints to validate address formats
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

-- 12. Create function to auto-create notification settings for new users
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

-- 13. Create trigger to auto-create notification settings
DROP TRIGGER IF EXISTS trigger_create_notification_settings ON profiles;
CREATE TRIGGER trigger_create_notification_settings
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_notification_settings_for_user();

-- 14. Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 15. Create trigger for notification_settings updated_at
DROP TRIGGER IF EXISTS trigger_update_notification_settings_updated_at ON notification_settings;
CREATE TRIGGER trigger_update_notification_settings_updated_at
  BEFORE UPDATE ON notification_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 16. Update existing profiles to have full_name from first_name + last_name
UPDATE profiles 
SET full_name = TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''))
WHERE full_name IS NULL AND (first_name IS NOT NULL OR last_name IS NOT NULL);