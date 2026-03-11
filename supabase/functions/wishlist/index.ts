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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ success: false, message: 'Unauthorized' }, 401);

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) return json({ success: false, message: 'Unauthorized' }, 401);

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // ---- GET WISHLIST (GET request) ----
    if (req.method === 'GET') {
      const { data, error } = await adminClient
        .from('wishlist')
        .select('id, product_id, created_at, products(id, title, price, images, condition)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return json({ success: true, data });
    }

    // ---- TOGGLE WISHLIST (POST request) ----
    if (req.method === 'POST') {
      const body = await req.json();
      const { product_id, isWishlist } = body;

      if (!product_id) {
        return json({ success: false, message: 'product_id is required' }, 400);
      }

      if (typeof isWishlist !== 'boolean') {
        return json({ success: false, message: 'isWishlist must be a boolean' }, 400);
      }

      if (isWishlist) {
        // Add to wishlist
        const { data, error } = await adminClient
          .from('wishlist')
          .upsert({ user_id: user.id, product_id }, { onConflict: 'user_id,product_id' })
          .select()
          .single();

        if (error) throw error;
        return json({ success: true, data, message: 'Added to wishlist' });
      } else {
        // Remove from wishlist
        const { error } = await adminClient
          .from('wishlist')
          .delete()
          .eq('user_id', user.id)
          .eq('product_id', product_id);

        if (error) throw error;
        return json({ success: true, message: 'Removed from wishlist' });
      }
    }

    return json({ success: false, message: 'Method not allowed' }, 405);
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
