
-- Add gender to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gender character varying DEFAULT '';

-- Create categories table
CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name character varying NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read categories" ON public.categories FOR SELECT TO anon, authenticated USING (true);

-- Create sub_categories table
CREATE TABLE IF NOT EXISTS public.sub_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name character varying NOT NULL,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(name, category_id)
);
ALTER TABLE public.sub_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read sub_categories" ON public.sub_categories FOR SELECT TO anon, authenticated USING (true);

-- Create products table
CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title character varying NOT NULL,
  description text DEFAULT '',
  price numeric(10,2) NOT NULL,
  images text[] DEFAULT '{}',
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  sub_category_id uuid REFERENCES public.sub_categories(id) ON DELETE SET NULL,
  seller_id uuid NOT NULL,
  condition character varying DEFAULT 'new',
  size character varying DEFAULT '',
  color character varying DEFAULT '',
  brand character varying DEFAULT '',
  location character varying DEFAULT '',
  is_sold boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read products" ON public.products FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Authenticated users can insert products" ON public.products FOR INSERT TO authenticated WITH CHECK (auth.uid() = seller_id);
CREATE POLICY "Sellers can update own products" ON public.products FOR UPDATE TO authenticated USING (auth.uid() = seller_id);
CREATE POLICY "Sellers can delete own products" ON public.products FOR DELETE TO authenticated USING (auth.uid() = seller_id);

-- Create wishlist table
CREATE TABLE IF NOT EXISTS public.wishlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_id)
);
ALTER TABLE public.wishlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own wishlist" ON public.wishlist FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can add to wishlist" ON public.wishlist FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove from wishlist" ON public.wishlist FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Trigger for products updated_at
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed categories
INSERT INTO public.categories (name) VALUES ('Man'), ('Woman'), ('Boys'), ('Girls')
ON CONFLICT (name) DO NOTHING;

-- Seed sub_categories for each category
INSERT INTO public.sub_categories (name, category_id)
SELECT s.name, c.id FROM (VALUES ('Jeans'), ('Shirt'), ('T-shirt'), ('Jacket'), ('Shorts'), ('Sweater')) AS s(name)
CROSS JOIN public.categories c
ON CONFLICT (name, category_id) DO NOTHING;
