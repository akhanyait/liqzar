
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  bottle_size TEXT,
  country TEXT,
  alcohol_pct TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  cheapest_retailer TEXT,
  checkers_price NUMERIC,
  pnp_price NUMERIC,
  tops_price NUMERIC,
  woolworths_price NUMERIC,
  norman_price NUMERIC,
  image_url TEXT,
  image_search_url TEXT,
  product_search_url TEXT,
  description TEXT,
  rating NUMERIC DEFAULT 4.5,
  review_count INTEGER DEFAULT 0,
  in_stock BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  is_trending BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Everyone can read products
CREATE POLICY "Anyone can read products" ON public.products FOR SELECT USING (true);

-- Only admins can manage products
CREATE POLICY "Admins can insert products" ON public.products FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update products" ON public.products FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete products" ON public.products FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
