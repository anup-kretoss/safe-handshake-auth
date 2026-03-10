
-- Drop the unique constraint that prevents same name in same category with different groups
ALTER TABLE public.sub_categories DROP CONSTRAINT IF EXISTS sub_categories_name_category_id_key;

-- Add material column to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS material character varying DEFAULT ''::character varying;

-- Add group_name column to sub_categories
ALTER TABLE public.sub_categories ADD COLUMN IF NOT EXISTS group_name character varying DEFAULT ''::character varying;

-- Add a new unique constraint that includes group_name
ALTER TABLE public.sub_categories ADD CONSTRAINT sub_categories_name_category_group_key UNIQUE (name, category_id, group_name);

-- Clear existing data
DELETE FROM public.wishlist;
DELETE FROM public.products;
DELETE FROM public.sub_categories;
DELETE FROM public.categories;

-- Insert categories
INSERT INTO public.categories (id, name) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'Man'),
  ('a1000000-0000-0000-0000-000000000002', 'Women'),
  ('a1000000-0000-0000-0000-000000000003', 'Kids');

-- Man sub_categories
INSERT INTO public.sub_categories (name, category_id, group_name) VALUES
  ('Jeans', 'a1000000-0000-0000-0000-000000000001', 'Clothing'),
  ('Shirt', 'a1000000-0000-0000-0000-000000000001', 'Clothing'),
  ('Shorts', 'a1000000-0000-0000-0000-000000000001', 'Clothing'),
  ('Trousers', 'a1000000-0000-0000-0000-000000000001', 'Clothing'),
  ('Active Wear', 'a1000000-0000-0000-0000-000000000001', 'Clothing'),
  ('Swim Wear', 'a1000000-0000-0000-0000-000000000001', 'Clothing'),
  ('Costume', 'a1000000-0000-0000-0000-000000000001', 'Clothing'),
  ('Suits', 'a1000000-0000-0000-0000-000000000001', 'Clothing'),
  ('Jumpers', 'a1000000-0000-0000-0000-000000000001', 'Clothing'),
  ('T-shirts/Tops', 'a1000000-0000-0000-0000-000000000001', 'Clothing'),
  ('Shoes', 'a1000000-0000-0000-0000-000000000001', 'Shoes'),
  ('Accessories', 'a1000000-0000-0000-0000-000000000001', 'Accessories');

-- Women sub_categories
INSERT INTO public.sub_categories (name, category_id, group_name) VALUES
  ('Skirts', 'a1000000-0000-0000-0000-000000000002', ''),
  ('Outwear', 'a1000000-0000-0000-0000-000000000002', ''),
  ('Tops and T-shirts', 'a1000000-0000-0000-0000-000000000002', ''),
  ('Trousers and Leggings', 'a1000000-0000-0000-0000-000000000002', ''),
  ('Swimwear and Beachwear', 'a1000000-0000-0000-0000-000000000002', ''),
  ('Lingerie and Nightwear', 'a1000000-0000-0000-0000-000000000002', '');

-- Kids > Boys
INSERT INTO public.sub_categories (name, category_id, group_name) VALUES
  ('Rompers', 'a1000000-0000-0000-0000-000000000003', 'Boys'),
  ('Baby Grows', 'a1000000-0000-0000-0000-000000000003', 'Boys'),
  ('Dungarees', 'a1000000-0000-0000-0000-000000000003', 'Boys'),
  ('Sets', 'a1000000-0000-0000-0000-000000000003', 'Boys');

-- Kids > Girls
INSERT INTO public.sub_categories (name, category_id, group_name) VALUES
  ('Rompers', 'a1000000-0000-0000-0000-000000000003', 'Girls'),
  ('Baby Grows', 'a1000000-0000-0000-0000-000000000003', 'Girls'),
  ('Dungarees', 'a1000000-0000-0000-0000-000000000003', 'Girls'),
  ('Dress', 'a1000000-0000-0000-0000-000000000003', 'Girls');
