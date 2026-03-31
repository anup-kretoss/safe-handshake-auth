
-- RPC to expire 1-hour seller delivery requests
CREATE OR REPLACE FUNCTION expire_seller_delivery_requests()
RETURNS TABLE (order_id uuid, buyer_id uuid, product_id uuid) AS $$
BEGIN
  RETURN QUERY
  WITH expired_reqs AS (
    UPDATE public.delivery_requests
    SET status = 'expired', updated_at = NOW()
    WHERE status = 'pending' AND expires_at < NOW()
    RETURNING delivery_requests.order_id, delivery_requests.buyer_id, delivery_requests.product_id
  )
  UPDATE public.orders o
  SET 
    delivery_type = 'standard',
    delivery_price = 20,
    updated_at = NOW()
  FROM expired_reqs er
  WHERE o.id = er.order_id
  RETURNING o.id, o.buyer_id, o.product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure profile-images bucket exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('profile-images', 'profile-images', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage policies for profile images
CREATE POLICY "Anyone can view profile images" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'profile-images');

CREATE POLICY "Authenticated users can upload own profile image" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'profile-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update own profile image" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'profile-images' AND (storage.foldername(name))[1] = auth.uid()::text);
