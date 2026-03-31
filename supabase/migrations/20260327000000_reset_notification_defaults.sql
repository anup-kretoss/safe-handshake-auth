-- Reset all existing users to have all notifications enabled
UPDATE notification_settings SET
  general_notifications  = true,
  email_notifications    = true,
  message_notifications  = true,
  payment_notifications  = true,
  update_notifications   = true,
  updated_at             = NOW();

-- Update trigger to explicitly set all fields to true on new user creation
CREATE OR REPLACE FUNCTION create_notification_settings_for_user()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO notification_settings (
    user_id,
    general_notifications,
    email_notifications,
    message_notifications,
    payment_notifications,
    update_notifications
  )
  VALUES (
    NEW.user_id,
    true,
    true,
    true,
    true,
    true
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;
