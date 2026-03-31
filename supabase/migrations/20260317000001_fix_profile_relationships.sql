
-- Fix Relationship between orders and profiles
-- This ensures Supabase can correctly join orders and profiles table using foreign keys

-- 1. Add foreign keys to orders table
ALTER TABLE public.orders 
  DROP CONSTRAINT IF EXISTS orders_buyer_id_fkey,
  DROP CONSTRAINT IF EXISTS orders_seller_id_fkey;

ALTER TABLE public.orders 
  ADD CONSTRAINT orders_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.profiles(user_id),
  ADD CONSTRAINT orders_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.profiles(user_id);

-- 2. Add foreign keys to delivery_requests table
ALTER TABLE public.delivery_requests
  DROP CONSTRAINT IF EXISTS delivery_requests_buyer_id_fkey,
  DROP CONSTRAINT IF EXISTS delivery_requests_seller_id_fkey;

ALTER TABLE public.delivery_requests
  ADD CONSTRAINT delivery_requests_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.profiles(user_id),
  ADD CONSTRAINT delivery_requests_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.profiles(user_id);

-- 3. Add foreign keys to products table
ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_seller_id_fkey;

ALTER TABLE public.products
  ADD CONSTRAINT products_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.profiles(user_id);

-- 4. Add foreign keys to wishlist table
ALTER TABLE public.wishlist
  DROP CONSTRAINT IF EXISTS wishlist_user_id_fkey;

ALTER TABLE public.wishlist
  ADD CONSTRAINT wishlist_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id);

-- 5. Add foreign keys to conversations table
ALTER TABLE public.conversations
  DROP CONSTRAINT IF EXISTS conversations_buyer_id_fkey,
  DROP CONSTRAINT IF EXISTS conversations_seller_id_fkey;

ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.profiles(user_id),
  ADD CONSTRAINT conversations_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.profiles(user_id);

-- 6. Add foreign keys to messages table
ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_sender_id_fkey;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.profiles(user_id);

-- 7. Add foreign keys to notifications table
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id);

-- 8. Add foreign keys to notification_settings table
ALTER TABLE public.notification_settings
  DROP CONSTRAINT IF EXISTS notification_settings_user_id_fkey;

ALTER TABLE public.notification_settings
  ADD CONSTRAINT notification_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id);
