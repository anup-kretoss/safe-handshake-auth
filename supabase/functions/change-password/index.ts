import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail, passwordChangedEmail } from "../_shared/mailer.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ success: false, message: 'POST required' }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ success: false, message: 'Unauthorized' }, 401);

    // Verify current user
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) return json({ success: false, message: 'Unauthorized' }, 401);

    const body = await req.json();
    const { old_password, new_password } = body;

    if (!old_password || !new_password) {
      return json({ success: false, message: 'old_password and new_password are required' }, 400);
    }

    if (new_password.length < 6) {
      return json({ success: false, message: 'New password must be at least 6 characters' }, 400);
    }

    // Verify old password by attempting sign in
    const verifyClient = createClient(supabaseUrl, supabaseAnonKey);
    const { error: signInError } = await verifyClient.auth.signInWithPassword({
      email: user.email!,
      password: old_password,
    });

    if (signInError) {
      return json({ success: false, message: 'Current password is incorrect' }, 400);
    }

    // Update password using admin client
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { error: updateError } = await adminClient.auth.admin.updateUserById(user.id, {
      password: new_password,
    });

    if (updateError) {
      return json({ success: false, message: updateError.message || 'Failed to update password' }, 500);
    }

    // Fetch user's first name for personalised email
    const { data: profile } = await adminClient
      .from('profiles')
      .select('first_name')
      .eq('user_id', user.id)
      .maybeSingle();

    // Send password changed confirmation email (non-blocking)
    sendEmail({
      to: user.email!,
      subject: "Your Souk IT Password Has Been Changed",
      html: passwordChangedEmail(profile?.first_name || ''),
    }).catch((e) => console.error("[change-password] email failed:", e));

    return json({ success: true, message: 'Password changed successfully' });
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
