import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;

    const publicClient = createClient(supabaseUrl, supabaseAnonKey);

    // ---- GET ALL LOCATIONS ----
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const country = url.searchParams.get('country') || 'UAE';
      const isActive = url.searchParams.get('active') !== 'false'; // Default to true

      let query = publicClient
        .from('locations')
        .select('id, name, country, is_active')
        .eq('country', country)
        .order('name', { ascending: true });

      if (isActive) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;
      if (error) throw error;

      return json({ 
        success: true, 
        data: data || [],
        total: data?.length || 0,
        country
      });
    }

    return json({ success: false, message: 'Method not allowed' }, 405);
  } catch (err) {
    console.error('Locations error:', err);
    return json({ 
      success: false, 
      message: err.message || 'Internal server error' 
    }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}