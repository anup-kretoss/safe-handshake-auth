import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    // Add columns one by one
    const commands = [
      "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_image TEXT;",
      "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username TEXT;",
      "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS user_description TEXT;",
      "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS full_name TEXT;",
      "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS collection_address JSONB;",
      "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS delivery_address JSONB;",
      "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';"
    ];

    const results = [];
    for (const command of commands) {
      try {
        const { error } = await adminClient.rpc('exec_sql', { sql_query: command });
        if (error) {
          results.push({ command, success: false, error: error.message });
        } else {
          results.push({ command, success: true });
        }
      } catch (err) {
        results.push({ command, success: false, error: err.message });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Column addition completed',
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({
      success: false,
      error: err.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});