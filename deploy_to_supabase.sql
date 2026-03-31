-- Deploy Enhanced Profile System with SELLER APPROVAL (NOT Admin) for 24-Hour Delivery
-- Run this SQL in your Supabase SQL Editor

-- Create locations table for dropdown options
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

-- Create notification_settings table
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

-- Create policies for notification_settings
DROP POLICY IF EXISTS "Users can view their own notification settings" ON notification_settings;
CREATE POLICY "Users can view their own notification settings"
  ON notification_settings FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own notification settings" ON notification_settings;
CREATE POLICY "Users can update their own notification settings"
  ON notification_settings FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own notification settings" ON notification_settings;
CREATE POLICY "Users can insert their own notification settings"
  ON notification_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Add admin role to profiles table (Admin manages platform, NOT delivery approvals)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'super_admin'));

-- Update delivery_requests table - REMOVE admin approval requirement
ALTER TABLE delivery_requests DROP COLUMN IF EXISTS requires_admin_approval;
ALTER TABLE delivery_requests DROP COLUMN IF EXISTS admin_status;

-- Remove admin_delivery_requests table as it's no longer needed
DROP TABLE IF EXISTS admin_delivery_requests CASCADE;

-- Enhance profiles table with SIGNUP FIELDS (Name, Email, Phone, Collection Address, Delivery Address)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS profile_image TEXT,
ADD COLUMN IF NOT EXISTS username TEXT,
ADD COLUMN IF NOT EXISTS user_description TEXT,
ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id),
ADD COLUMN IF NOT EXISTS full_name TEXT,
ADD COLUMN IF NOT EXISTS collection_address JSONB, -- Required at signup
ADD COLUMN IF NOT EXISTS delivery_address JSONB, -- Required at signup
ADD COLUMN IF NOT EXISTS fcm_token TEXT; -- Added for FCM notifications

-- Remove pickup_addresses as it's replaced by collection_address and delivery_address
ALTER TABLE profiles DROP COLUMN IF EXISTS pickup_addresses;

-- Create unique index for username
DROP INDEX IF EXISTS idx_profiles_username;
CREATE UNIQUE INDEX idx_profiles_username ON profiles(username) WHERE username IS NOT NULL;

-- Create index for location_id
CREATE INDEX IF NOT EXISTS idx_profiles_location_id ON profiles(location_id);

-- Update existing profiles to have full_name from first_name + last_name
UPDATE profiles 
SET full_name = TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''))
WHERE full_name IS NULL AND (first_name IS NOT NULL OR last_name IS NOT NULL);

-- Create function to auto-expire SELLER delivery requests (1 hour window)
CREATE OR REPLACE FUNCTION expire_seller_delivery_requests()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update expired delivery requests
  UPDATE delivery_requests 
  SET status = 'expired', updated_at = NOW()
  WHERE status = 'pending' AND expires_at < NOW();
  
  -- Update corresponding orders to standard delivery
  UPDATE orders 
  SET delivery_type = 'standard', delivery_price = 20, status = 'paid', updated_at = NOW()
  WHERE id IN (
    SELECT order_id 
    FROM delivery_requests 
    WHERE status = 'expired' AND delivery_type = '24hour'
  );
  
  -- Mark products as sold for expired requests
  UPDATE products 
  SET is_sold = true, updated_at = NOW()
  WHERE id IN (
    SELECT product_id 
    FROM delivery_requests 
    WHERE status = 'expired'
  );
END;
$$;

-- Create function to auto-create notification settings for new users
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

-- Create trigger to auto-create notification settings
DROP TRIGGER IF EXISTS trigger_create_notification_settings ON profiles;
CREATE TRIGGER trigger_create_notification_settings
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_notification_settings_for_user();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Create trigger for notification_settings updated_at
DROP TRIGGER IF EXISTS trigger_update_notification_settings_updated_at ON notification_settings;
CREATE TRIGGER trigger_update_notification_settings_updated_at
  BEFORE UPDATE ON notification_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create trigger for profiles updated_at
DROP TRIGGER IF EXISTS trigger_update_profiles_updated_at ON profiles;
CREATE TRIGGER trigger_update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create function to validate address JSON structure
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

-- Add constraints to validate address formats
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

-- Insert default admin user (update with actual admin email)
INSERT INTO profiles (user_id, email, first_name, last_name, role)
SELECT 
  id,
  email,
  'Admin',
  'User',
  'admin'
FROM auth.users 
WHERE email = 'admin@soukit.com'
ON CONFLICT (user_id) DO UPDATE SET role = 'admin';

-- Create storage bucket for profile images (if not exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-images', 'profile-images', true)
ON CONFLICT (id) DO NOTHING;

-- Create notifications table for in-app notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'general',
  data JSONB DEFAULT '{}'::jsonb,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  read_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can insert notifications" ON notifications;
CREATE POLICY "Service role can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);