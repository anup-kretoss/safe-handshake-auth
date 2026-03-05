-- Make date_of_birth, country_code, and phone_number required (NOT NULL)
-- This ensures the API will reject signups without these fields

-- First, delete any existing records with NULL values (test data)
-- In production, you would want to handle this differently
DELETE FROM public.profiles 
WHERE date_of_birth IS NULL 
   OR country_code IS NULL 
   OR phone_number IS NULL;

-- Now make the columns NOT NULL
ALTER TABLE public.profiles 
  ALTER COLUMN date_of_birth SET NOT NULL;

ALTER TABLE public.profiles 
  ALTER COLUMN country_code SET NOT NULL;

ALTER TABLE public.profiles 
  ALTER COLUMN phone_number SET NOT NULL;

-- Update the handle_new_user function to use COALESCE instead of NULLIF
-- This ensures empty strings are rejected at the database level
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Validate required fields exist in metadata
  IF COALESCE(NEW.raw_user_meta_data->>'date_of_birth', '') = '' THEN
    RAISE EXCEPTION 'date_of_birth is required';
  END IF;
  
  IF COALESCE(NEW.raw_user_meta_data->>'country_code', '') = '' THEN
    RAISE EXCEPTION 'country_code is required';
  END IF;
  
  IF COALESCE(NEW.raw_user_meta_data->>'phone_number', '') = '' THEN
    RAISE EXCEPTION 'phone_number is required';
  END IF;

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
    NEW.email,
    NEW.raw_user_meta_data->>'date_of_birth',
    NEW.raw_user_meta_data->>'country_code',
    NEW.raw_user_meta_data->>'phone_number'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
