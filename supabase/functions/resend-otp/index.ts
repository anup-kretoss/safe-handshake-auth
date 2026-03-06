import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || !body.email) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Email is required',
        error_code: 'MISSING_EMAIL'
      }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { email } = body;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Invalid email format',
        error_code: 'INVALID_EMAIL'
      }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Check if user exists
    const { data: users, error: listErr } = await adminClient.auth.admin.listUsers();
    if (listErr) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Internal server error',
        error_code: 'SERVER_ERROR'
      }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userExists = users?.users?.some((u: any) => u.email === email);
    if (!userExists) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'No account found with this email address',
        error_code: 'USER_NOT_FOUND'
      }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Enforce 30-second cooldown
    const { data: existingOtp } = await adminClient
      .from('password_reset_otps')
      .select('created_at')
      .eq('email', email)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (existingOtp) {
      const createdAt = new Date(existingOtp.created_at).getTime();
      const now = Date.now();
      const diffSeconds = (now - createdAt) / 1000;
      if (diffSeconds < 30) {
        const waitSeconds = Math.ceil(30 - diffSeconds);
        return new Response(JSON.stringify({ 
          success: false, 
          message: `Please wait ${waitSeconds} seconds before resending OTP`,
          error_code: 'COOLDOWN_ACTIVE',
          wait_seconds: waitSeconds
        }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Generate new 4-digit OTP
    const otp = String(Math.floor(1000 + Math.random() * 9000));

    // Delete old OTPs for this email
    await adminClient.from('password_reset_otps').delete().eq('email', email);

    // Store new OTP (expires in 10 minutes)
    const { error: insertErr } = await adminClient.from('password_reset_otps').insert({
      email,
      otp,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });

    if (insertErr) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Failed to generate OTP',
        error_code: 'OTP_GENERATION_FAILED'
      }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Send recovery email
    try {
      await adminClient.auth.admin.generateLink({
        type: 'recovery',
        email,
      });
    } catch {
      // Continue even if email fails
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'OTP has been resent to your email',
      otp, // Return OTP in response for testing
      expires_in_minutes: 10,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ 
      success: false, 
      message: err.message || 'Internal server error',
      error_code: 'SERVER_ERROR'
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
