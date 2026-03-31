import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail, productListedEmail } from "../_shared/mailer.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

serve(async (req: Request) => {
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

    // ---- ADD CATEGORY (open to all authenticated users) ----
    if (action === 'add-category') {
      if (req.method !== 'POST') return json({ success: false, message: 'POST required' }, 405);
      const adminClient = createClient(supabaseUrl, serviceRoleKey);
      const body = await req.json();
      const { name } = body;
      if (!name || String(name).trim() === '') {
        return json({ success: false, message: 'name is required' }, 400);
      }
      const { data, error } = await adminClient
        .from('categories')
        .insert({ name: String(name).trim() })
        .select()
        .single();
      if (error) throw error;
      return json({ success: true, data });
    }

    // ---- ADD SUB CATEGORY (open to all authenticated users) ----
    if (action === 'add-sub-category') {
      if (req.method !== 'POST') return json({ success: false, message: 'POST required' }, 405);
      const adminClient = createClient(supabaseUrl, serviceRoleKey);
      const body = await req.json();
      const { name, category_id, group_name } = body;
      if (!name || String(name).trim() === '') {
        return json({ success: false, message: 'name is required' }, 400);
      }
      if (!category_id) {
        return json({ success: false, message: 'category_id is required' }, 400);
      }
      // Verify category exists
      const { data: cat } = await adminClient.from('categories').select('id').eq('id', category_id).single();
      if (!cat) return json({ success: false, message: 'category_id not found' }, 404);

      const { data, error } = await adminClient
        .from('sub_categories')
        .insert({ name: String(name).trim(), category_id, group_name: group_name || null })
        .select()
        .single();
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

      // Optionally resolve wishlist for authenticated user
      const adminClient = createClient(supabaseUrl, serviceRoleKey);
      let wishlistedIds = new Set<string>();
      const authHeader = req.headers.get('Authorization');
      if (authHeader) {
        try {
          const token = authHeader.replace('Bearer ', '').trim();
          const { data: { user: authUser } } = await adminClient.auth.getUser(token);
          if (authUser) {
            const productIds = (data || []).map((p: any) => p.id);
            const { data: wishlistRows } = await adminClient
              .from('wishlist')
              .select('product_id')
              .eq('user_id', authUser.id)
              .in('product_id', productIds);
            wishlistedIds = new Set((wishlistRows || []).map((w: any) => w.product_id));
          }
        } catch (_) {
          // silently ignore — isWishlist stays false for all
        }
      }

      // Add calculated price with service fee + isWishlist
      const enriched = (data || []).map((p: any) => {
        const feePercent = p.service_fee_percentage || 12.5;
        const priceWithFee = Math.ceil(p.price * (1 + feePercent / 100) * 100) / 100;
        return {
          ...p,
          actual_price: p.price,
          display_price: priceWithFee,
          service_fee_percentage: feePercent,
          isWishlist: wishlistedIds.has(p.id),
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

      const adminClient = createClient(supabaseUrl, serviceRoleKey);

      // Get seller profile
      const { data: sellerProfile } = await adminClient
        .from('profiles')
        .select('first_name, last_name, user_id, profile_image')
        .eq('user_id', data.seller_id)
        .single();

      // Check wishlist status if user is authenticated (optional — no error if missing)
      let isWishlist = false;
      const authHeader = req.headers.get('Authorization');
      if (authHeader) {
        try {
          const token = authHeader.replace('Bearer ', '').trim();
          const { data: { user: authUser } } = await adminClient.auth.getUser(token);
          if (authUser) {
            const { data: wishlistRow } = await adminClient
              .from('wishlist')
              .select('id')
              .eq('user_id', authUser.id)
              .eq('product_id', productId)
              .maybeSingle();
            isWishlist = !!wishlistRow;
          }
        } catch (_) {
          // silently ignore auth errors — isWishlist stays false
        }
      }

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
          seller_image_url: sellerProfile?.profile_image || null,
          isWishlist,
        },
      });
    }

    // Authentication helper for protected routes
    const getAuthenticatedUser = async () => {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) throw new Error('Unauthorized');
      const token = authHeader.replace('Bearer ', '').trim();
      const adminClient = createClient(supabaseUrl, serviceRoleKey);
      const { data: { user }, error: authError } = await adminClient.auth.getUser(token);
      if (authError || !user) throw new Error('Invalid JWT or session expired');
      return { user, adminClient };
    };

    // ---- LISTED ITEMS (seller's own products) ----
    if (action === 'listed') {
      try {
        const { user } = await getAuthenticatedUser();
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
      } catch (e: any) {
        return json({ success: false, message: e.message }, 401);
      }
    }

    // ---- GET PICKUP ADDRESS ----
    if (action === 'pickup-address') {
      try {
        const { user } = await getAuthenticatedUser();
        const { data, error } = await publicClient
          .from('products')
          .select('id, title, pickup_address')
          .eq('seller_id', user.id)
          .not('pickup_address', 'is', null)
          .order('created_at', { ascending: false });

        if (error) throw error;
        return json({ success: true, data });
      } catch (e: any) {
        return json({ success: false, message: e.message }, 401);
      }
    }

    // ---- SELL AN ITEM (CREATE PRODUCT) ----
    if (action === 'create') {
      if (req.method !== 'POST') return json({ success: false, message: 'POST required' }, 405);
      try {
        const { user, adminClient } = await getAuthenticatedUser();
        const productData = await req.json();

        const { title, description, price, images, category_id, sub_category_id, condition, size, color, brand, material, pickup_address_id } = productData;

        if (!title || price === undefined || price === null || !category_id) {
          return json({ success: false, message: 'title, price, and category_id are required' }, 400);
        }
        if (!description || String(description).trim() === '') {
          return json({ success: false, message: 'description is required' }, 400);
        }
        if (!images || !Array.isArray(images) || images.length === 0) {
          return json({ success: false, message: 'images is required and must be a non-empty array' }, 400);
        }
        if (!size || String(size).trim() === '') {
          return json({ success: false, message: 'size is required' }, 400);
        }
        if (!color || String(color).trim() === '') {
          return json({ success: false, message: 'color is required' }, 400);
        }
        if (!brand || String(brand).trim() === '') {
          return json({ success: false, message: 'brand is required' }, 400);
        }
        if (!condition || !['new', 'good', 'worn'].includes(condition)) {
          return json({ success: false, message: 'condition is required and must be new, good, or worn' }, 400);
        }

        // Fetch user's pickup addresses
        const { data: profileRow } = await adminClient
          .from('profiles')
          .select('collection_address')
          .eq('user_id', user.id)
          .single();

        const existingAddrs: any[] = (() => {
          const raw = profileRow?.collection_address;
          if (!raw) return [];
          if (Array.isArray(raw)) return raw;
          if (typeof raw === 'object') return [{ id: 'legacy', ...raw }];
          return [];
        })();

        // Resolve pickup address
        let resolvedPickup: any = null;
        if (pickup_address_id) {
          // User explicitly provided a pickup_address_id
          resolvedPickup = existingAddrs.find((a: any) => a.id === pickup_address_id);
          if (!resolvedPickup) {
            return json({ success: false, message: `pickup_address_id "${pickup_address_id}" not found in your saved pickup addresses.` }, 404);
          }
        } else {
          // No pickup_address_id provided — use first pickup address by default
          resolvedPickup = existingAddrs.length > 0 ? existingAddrs[0] : null;
        }

        // Create product — pickup_address stored only if provided
        const { data: product, error } = await adminClient
          .from('products')
          .insert({
            title,
            description: description || '',
            price: parseFloat(String(price)),
            images: Array.isArray(images) ? images : [],
            category_id,
            sub_category_id: sub_category_id || null,
            seller_id: user.id,
            condition,
            size: size || '',
            color: color || '',
            brand: brand || '',
            material: material || '',
            pickup_address: resolvedPickup ? { ...resolvedPickup, pickup_address_id: resolvedPickup.id } : null,
          })
          .select('*, categories(name), sub_categories(name, group_name)')
          .single();

        if (error) throw error;

        // Send product listed email (non-blocking)
        const { data: sellerProfile } = await adminClient
          .from('profiles')
          .select('first_name, last_name')
          .eq('user_id', user.id)
          .maybeSingle();
        const sellerName = sellerProfile
          ? `${sellerProfile.first_name} ${sellerProfile.last_name}`.trim()
          : 'Seller';
        sendEmail({
          to: user.email!,
          subject: `Your item "${title}" is now live on Souk IT`,
          html: productListedEmail(sellerName, title, parseFloat(String(price)), product.id),
        }).catch((e) => console.error("[products/create] email failed:", e));

        return json({ success: true, data: product });
      } catch (e: any) {
        return json({ success: false, message: e.message }, e.message === 'Unauthorized' || e.message === 'Invalid JWT or session expired' ? 401 : 400);
      }
    }

    // ---- UPDATE PRODUCT ----
    if (action === 'update') {
      if (req.method !== 'POST') return json({ success: false, message: 'POST required' }, 405);
      try {
        const { user, adminClient } = await getAuthenticatedUser();
        const body = await req.json();
        const { id, pickup_address_id, ...updates } = body;

        if (!id) return json({ success: false, message: 'Product id is required' }, 400);

        const { data: existing } = await adminClient.from('products').select('seller_id, pickup_address').eq('id', id).single();
        if (!existing || existing.seller_id !== user.id) {
          return json({ success: false, message: 'Not authorized to update this product' }, 403);
        }

        // If pickup_address_id provided, resolve and update pickup_address JSONB field
        if (pickup_address_id) {
          const { data: profileRow } = await adminClient
            .from('profiles')
            .select('collection_address')
            .eq('user_id', user.id)
            .single();

          const existingAddrs: any[] = (() => {
            const raw = profileRow?.collection_address;
            if (!raw) return [];
            if (Array.isArray(raw)) return raw;
            if (typeof raw === 'object') return [{ id: 'legacy', ...raw }];
            return [];
          })();

          const resolvedPickup = existingAddrs.find((a: any) => a.id === pickup_address_id);
          if (!resolvedPickup) {
            return json({ success: false, message: `pickup_address_id "${pickup_address_id}" not found in your saved pickup addresses.` }, 404);
          }

          updates.pickup_address = { ...resolvedPickup, pickup_address_id };
        }

        const { data, error } = await adminClient.from('products').update(updates).eq('id', id).select().single();
        if (error) throw error;

        return json({ success: true, data });
      } catch (e: any) {
        return json({ success: false, message: e.message }, 401);
      }
    }

    // ---- DELETE PRODUCT ----
    if (action === 'delete') {
      if (req.method !== 'POST') return json({ success: false, message: 'POST required' }, 405);
      try {
        const { user, adminClient } = await getAuthenticatedUser();
        const body = await req.json();
        const { id } = body;

        if (!id) return json({ success: false, message: 'Product id is required' }, 400);

        const { data: existing } = await adminClient.from('products').select('seller_id').eq('id', id).single();
        if (!existing || existing.seller_id !== user.id) {
          return json({ success: false, message: 'Not authorized to delete this product' }, 403);
        }

        const { error } = await adminClient.from('products').delete().eq('id', id);
        if (error) throw error;

        return json({ success: true, message: 'Product deleted' });
      } catch (e: any) {
        return json({ success: false, message: e.message }, 401);
      }
    }

    return json({ success: false, message: 'Invalid action' }, 400);
  } catch (err: any) {
    return json({ success: false, message: err.message || 'Internal server error' }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
