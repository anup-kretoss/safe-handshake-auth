import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, reset_token, new_password } = await req.json();
    if (!email || !reset_token || !new_password) {
      return new Response(JSON.stringify({ success: false, message: 'Email, reset_token, and new_password are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (new_password.length < 8) {
      return new Response(JSON.stringify({ success: false, message: 'Password must be at least 8 characters' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Verify the reset token is valid and verified
    const { data: otpRecord, error: fetchErr } = await adminClient
      .from('password_reset_otps')
      .select('*')
      .eq('id', reset_token)
      .eq('email', email)
      .eq('verified', true)
      .single();

    if (fetchErr || !otpRecord) {
      return new Response(JSON.stringify({ success: false, message: 'Invalid or expired reset token' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check expiry (allow 15 min after verification)
    if (new Date(otpRecord.expires_at) < new Date(Date.now() - 5 * 60 * 1000)) {
      return new Response(JSON.stringify({ success: false, message: 'Reset token has expired' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find the user by email
    const { data: users, error: listErr } = await adminClient.auth.admin.listUsers();
    const user = users?.users?.find((u: any) => u.email === email);
    
    if (listErr || !user) {
      return new Response(JSON.stringify({ success: false, message: 'User not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update password using admin API
    const { error: updateErr } = await adminClient.auth.admin.updateUserById(user.id, {
      password: new_password,
    });

    if (updateErr) {
      return new Response(JSON.stringify({ success: false, message: updateErr.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Delete all OTPs for this email
    await adminClient.from('password_reset_otps').delete().eq('email', email);

    return new Response(JSON.stringify({ success: true, message: 'Password updated successfully' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, message: err.message || 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
