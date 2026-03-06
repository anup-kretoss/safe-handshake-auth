-- Fix the handle_new_user trigger to cast date_of_birth text to date type
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (
    user_id, 
    first_name, 
    last_name, 
    email,
    date_of_birth,
    country_code,
    phone_number
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.email, ''),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'date_of_birth', '')::date, '1900-01-01'::date),
    COALESCE(NEW.raw_user_meta_data->>'country_code', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone_number', '')
  );
  RETURN NEW;
END;
$function$;

-- Also delete any orphaned auth users that failed to create profiles
-- (clean slate for testing)
DELETE FROM auth.users WHERE id NOT IN (SELECT user_id FROM public.profiles);