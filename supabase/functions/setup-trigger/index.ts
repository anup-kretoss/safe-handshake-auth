import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (_req) => {
  // Use service role to call a raw SQL via pg via supabase-js rpc
  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Check if trigger exists
  const { data: triggers, error: triggerErr } = await adminClient
    .rpc('check_trigger_exists');

  // Check recent pg_net calls
  const { data: netCalls, error: netErr } = await adminClient
    .rpc('check_net_calls');

  return new Response(JSON.stringify({
    triggers,
    triggerErr,
    netCalls,
    netErr
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
});
