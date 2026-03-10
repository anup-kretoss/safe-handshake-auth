import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'list';

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const publicClient = createClient(supabaseUrl, supabaseAnonKey);

    // ---- GET CATEGORIES ----
    if (action === 'categories') {
      const { data, error } = await publicClient
        .from('categories')
        .select('id, name, created_at');
      if (error) throw error;
      return json({ success: true, data });
    }

    // ---- GET SUB CATEGORIES (with group_name) ----
    if (action === 'sub_categories') {
      const categoryId = url.searchParams.get('category_id');
      let query = publicClient.from('sub_categories').select('id, name, category_id, group_name, created_at');
      if (categoryId) query = query.eq('category_id', categoryId);
      const { data, error } = await query;
      if (error) throw error;
      return json({ success: true, data });
    }

    // ---- LIST / SEARCH / FILTER PRODUCTS ----
    if (action === 'list' || action === 'search') {
      const categoryId = url.searchParams.get('category_id');
      const subCategoryId = url.searchParams.get('sub_category_id');
      const search = url.searchParams.get('q');
      const minPrice = url.searchParams.get('min_price');
      const maxPrice = url.searchParams.get('max_price');
      const condition = url.searchParams.get('condition');
      const size = url.searchParams.get('size');
      const brand = url.searchParams.get('brand');
      const sellerId = url.searchParams.get('seller_id');
      const limit = parseInt(url.searchParams.get('limit') || '20');
      const offset = parseInt(url.searchParams.get('offset') || '0');

      let query = publicClient
        .from('products')
        .select('*, categories(name), sub_categories(name, group_name)')
        .eq('is_sold', false)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (categoryId) query = query.eq('category_id', categoryId);
      if (subCategoryId) query = query.eq('sub_category_id', subCategoryId);
      if (search) query = query.ilike('title', `%${search}%`);
      if (minPrice) query = query.gte('price', parseFloat(minPrice));
      if (maxPrice) query = query.lte('price', parseFloat(maxPrice));
      if (condition) query = query.eq('condition', condition);
      if (size) query = query.ilike('size', `%${size}%`);
      if (brand) query = query.ilike('brand', `%${brand}%`);
      if (sellerId) query = query.eq('seller_id', sellerId);

      const { data, error, count } = await query;
      if (error) throw error;
      return json({ success: true, data, count });
    }

    // ---- GET PRODUCT DETAILS ----
    if (action === 'detail') {
      const productId = url.searchParams.get('id');
      if (!productId) return json({ success: false, message: 'Product id is required' }, 400);

      const { data, error } = await publicClient
        .from('products')
        .select('*, categories(name), sub_categories(name, group_name)')
        .eq('id', productId)
        .single();
      if (error) throw error;
      return json({ success: true, data });
    }

    // ---- SELL AN ITEM (CREATE PRODUCT) ----
    if (action === 'create') {
      if (req.method !== 'POST') return json({ success: false, message: 'POST required' }, 405);

      const authHeader = req.headers.get('Authorization');
      if (!authHeader) return json({ success: false, message: 'Unauthorized' }, 401);

      const authClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: authError } = await authClient.auth.getUser();
      if (authError || !user) return json({ success: false, message: 'Unauthorized' }, 401);

      const body = await req.json();
      const { title, description, price, images, category_id, sub_category_id, condition, size, color, brand, material, location } = body;

      if (!title || !price || !category_id) {
        return json({ success: false, message: 'title, price, and category_id are required' }, 400);
      }

      const adminClient = createClient(supabaseUrl, serviceRoleKey);
      const { data, error } = await adminClient
        .from('products')
        .insert({
          title,
          description: description || '',
          price: parseFloat(price),
          images: images || [],
          category_id,
          sub_category_id: sub_category_id || null,
          seller_id: user.id,
          condition: condition || 'new',
          size: size || '',
          color: color || '',
          brand: brand || '',
          material: material || '',
          location: location || '',
        })
        .select()
        .single();

      if (error) throw error;
      return json({ success: true, data });
    }

    // ---- UPDATE PRODUCT ----
    if (action === 'update') {
      if (req.method !== 'POST') return json({ success: false, message: 'POST required' }, 405);

      const authHeader = req.headers.get('Authorization');
      if (!authHeader) return json({ success: false, message: 'Unauthorized' }, 401);

      const authClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: authError } = await authClient.auth.getUser();
      if (authError || !user) return json({ success: false, message: 'Unauthorized' }, 401);

      const body = await req.json();
      const { id, ...updates } = body;
      if (!id) return json({ success: false, message: 'Product id is required' }, 400);

      const adminClient = createClient(supabaseUrl, serviceRoleKey);
      const { data: existing } = await adminClient.from('products').select('seller_id').eq('id', id).single();
      if (!existing || existing.seller_id !== user.id) {
        return json({ success: false, message: 'Not authorized to update this product' }, 403);
      }

      const { data, error } = await adminClient
        .from('products')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return json({ success: true, data });
    }

    // ---- DELETE PRODUCT ----
    if (action === 'delete') {
      if (req.method !== 'POST') return json({ success: false, message: 'POST required' }, 405);

      const authHeader = req.headers.get('Authorization');
      if (!authHeader) return json({ success: false, message: 'Unauthorized' }, 401);

      const authClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: authError } = await authClient.auth.getUser();
      if (authError || !user) return json({ success: false, message: 'Unauthorized' }, 401);

      const body = await req.json();
      const { id } = body;
      if (!id) return json({ success: false, message: 'Product id is required' }, 400);

      const adminClient = createClient(supabaseUrl, serviceRoleKey);
      const { data: existing } = await adminClient.from('products').select('seller_id').eq('id', id).single();
      if (!existing || existing.seller_id !== user.id) {
        return json({ success: false, message: 'Not authorized to delete this product' }, 403);
      }

      const { error } = await adminClient.from('products').delete().eq('id', id);
      if (error) throw error;
      return json({ success: true, message: 'Product deleted' });
    }

    return json({ success: false, message: 'Invalid action' }, 400);
  } catch (err) {
    return json({ success: false, message: err.message || 'Internal server error' }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
