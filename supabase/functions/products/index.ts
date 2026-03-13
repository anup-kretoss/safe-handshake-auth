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

    // ---- GET SUB CATEGORIES ----
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

      const { data, error } = await query;
      if (error) throw error;

      // Add calculated price with service fee
      const enriched = (data || []).map((p: any) => {
        const feePercent = p.service_fee_percentage || 12.5;
        const priceWithFee = Math.ceil(p.price * (1 + feePercent / 100) * 100) / 100;
        return {
          ...p,
          actual_price: p.price,
          display_price: priceWithFee,
          service_fee_percentage: feePercent,
        };
      });

      return json({ success: true, data: enriched });
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

      // Get seller profile for seller name
      const adminClient = createClient(supabaseUrl, serviceRoleKey);
      const { data: sellerProfile } = await adminClient
        .from('profiles')
        .select('first_name, last_name, user_id')
        .eq('user_id', data.seller_id)
        .single();

      const feePercent = data.service_fee_percentage || 12.5;
      const priceWithFee = Math.ceil(data.price * (1 + feePercent / 100) * 100) / 100;

      return json({
        success: true,
        data: {
          ...data,
          actual_price: data.price,
          display_price: priceWithFee,
          service_fee_percentage: feePercent,
          seller_name: sellerProfile ? `${sellerProfile.first_name} ${sellerProfile.last_name}`.trim() : 'Unknown',
          seller_user_id: data.seller_id,
        },
      });
    }

    // ---- LISTED ITEMS (seller's own products) ----
    if (action === 'listed') {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) return json({ success: false, message: 'Unauthorized' }, 401);

      const authClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: authError } = await authClient.auth.getUser();
      if (authError || !user) return json({ success: false, message: 'Unauthorized' }, 401);

      const { data, error } = await publicClient
        .from('products')
        .select('*, categories(name), sub_categories(name, group_name)')
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const enriched = (data || []).map((p: any) => {
        const feePercent = p.service_fee_percentage || 12.5;
        const priceWithFee = Math.ceil(p.price * (1 + feePercent / 100) * 100) / 100;
        return { ...p, actual_price: p.price, display_price: priceWithFee, service_fee_percentage: feePercent };
      });

      return json({ success: true, data: enriched });
    }

    // ---- GET PICKUP ADDRESS ----
    if (action === 'pickup-address') {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) return json({ success: false, message: 'Unauthorized' }, 401);

      const authClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: authError } = await authClient.auth.getUser();
      if (authError || !user) return json({ success: false, message: 'Unauthorized' }, 401);

      const { data, error } = await publicClient
        .from('products')
        .select('id, title, pickup_address')
        .eq('seller_id', user.id)
        .not('pickup_address', 'is', null)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Check if user is authenticated and add isWishlist field
      const authHeader = req.headers.get('Authorization');
      let isWishlist = false;

      if (authHeader) {
        try {
          const authClient = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authHeader } },
          });
          const { data: { user } } = await authClient.auth.getUser();
          
          if (user) {
            const adminClient = createClient(supabaseUrl, serviceRoleKey);
            const { data: wishlistData } = await adminClient
              .from('wishlist')
              .select('id')
              .eq('user_id', user.id)
              .eq('product_id', productId)
              .maybeSingle();

            isWishlist = !!wishlistData;
          }
        } catch (authError) {
          console.error('Auth error:', authError);
        }
      }

      return json({ success: true, data: { ...data, isWishlist } });
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
      const { title, description, price, images, category_id, sub_category_id, condition, size, color, brand, material, location, pickup_address } = body;

      if (!title || price === undefined || price === null || !category_id) {
        return json({ success: false, message: 'title, price, and category_id are required' }, 400);
      }

      // Validate pickup_address - all fields mandatory
      if (!pickup_address || typeof pickup_address !== 'object') {
        return json({ success: false, message: 'pickup_address is required with email, phone_number, address, town_city, postcode' }, 400);
      }
      const requiredPickupFields = ['email', 'phone_number', 'address', 'town_city', 'postcode'];
      const missingFields = requiredPickupFields.filter(f => !pickup_address[f] || String(pickup_address[f]).trim() === '');
      if (missingFields.length > 0) {
        return json({ success: false, message: `Pickup address missing required fields: ${missingFields.join(', ')}` }, 400);
      }

      if (!condition || !['new', 'good', 'worn'].includes(condition)) {
        return json({ success: false, message: 'condition is required and must be new, good, or worn' }, 400);
      }

      const adminClient = createClient(supabaseUrl, serviceRoleKey);
      const { data, error } = await adminClient
        .from('products')
        .insert({
          title,
          description: description || '',
          price: parseFloat(String(price)),
          images: images || [],
          category_id,
          sub_category_id: sub_category_id || null,
          seller_id: user.id,
          condition,
          size: size || '',
          color: color || '',
          brand: brand || '',
          material: material || '',
          location: location || '',
          pickup_address,
        })
        .select('*, categories(name), sub_categories(name, group_name)')
        .single();

      if (error) throw error;
      return json({ success: true, data });
    }

    // ---- UPLOAD PRODUCT IMAGES ----
    if (action === 'upload-images') {
      if (req.method !== 'POST') return json({ success: false, message: 'POST required' }, 405);

      const authHeader = req.headers.get('Authorization');
      if (!authHeader) return json({ success: false, message: 'Unauthorized' }, 401);

      const authClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: authError } = await authClient.auth.getUser();
      if (authError || !user) return json({ success: false, message: 'Unauthorized' }, 401);

      const formData = await req.formData();
      const files = formData.getAll('files');

      if (!files || files.length === 0) {
        return json({ success: false, message: 'No files provided' }, 400);
      }

      const adminClient = createClient(supabaseUrl, serviceRoleKey);
      const uploadedUrls: string[] = [];

      for (const file of files) {
        if (!(file instanceof File)) continue;
        const ext = file.name.split('.').pop() || 'jpg';
        const fileName = `${user.id}/${crypto.randomUUID()}.${ext}`;
        
        const { error: uploadError } = await adminClient.storage
          .from('product-images')
          .upload(fileName, file, { contentType: file.type, upsert: false });

        if (uploadError) throw uploadError;

        const { data: urlData } = adminClient.storage
          .from('product-images')
          .getPublicUrl(fileName);

        uploadedUrls.push(urlData.publicUrl);
      }

      return json({ success: true, data: { urls: uploadedUrls } });
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
