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

  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Request body is required',
        error_code: 'INVALID_BODY'
      }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { email, reset_token, new_password } = body;

    if (!email) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Email is required',
        error_code: 'MISSING_EMAIL'
      }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!reset_token) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Reset token is required. Please verify OTP first.',
        error_code: 'MISSING_RESET_TOKEN'
      }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!new_password) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'New password is required',
        error_code: 'MISSING_PASSWORD'
      }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (new_password.length < 8) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Password must be at least 8 characters',
        error_code: 'PASSWORD_TOO_SHORT'
      }), {
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
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Invalid or expired reset token. Please start the forgot password process again.',
        error_code: 'INVALID_RESET_TOKEN'
      }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check expiry - allow 15 minutes total from OTP creation
    if (new Date(otpRecord.expires_at) < new Date()) {
      await adminClient.from('password_reset_otps').delete().eq('id', otpRecord.id);
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Reset token has expired. Please request a new OTP.',
        error_code: 'RESET_TOKEN_EXPIRED'
      }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find the user by email
    const { data: users, error: listErr } = await adminClient.auth.admin.listUsers();
    const user = users?.users?.find((u: any) => u.email === email);
    
    if (listErr || !user) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'User not found',
        error_code: 'USER_NOT_FOUND'
      }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update password using admin API (this does NOT affect current sessions or login ability)
    const { error: updateErr } = await adminClient.auth.admin.updateUserById(user.id, {
      password: new_password,
    });

    if (updateErr) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: updateErr.message || 'Failed to update password',
        error_code: 'PASSWORD_UPDATE_FAILED'
      }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Delete all OTPs for this email (cleanup)
    await adminClient.from('password_reset_otps').delete().eq('email', email);

    // Fetch user's first name for personalised email
    const { data: profile } = await adminClient
      .from('profiles')
      .select('first_name')
      .eq('user_id', user.id)
      .maybeSingle();

    // Send password changed confirmation email (non-blocking)
    sendEmail({
      to: email,
      subject: "Your Souk IT Password Has Been Changed",
      html: passwordChangedEmail(profile?.first_name || ''),
    }).catch((e) => console.error("[reset-password-otp] email failed:", e));

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Password updated successfully. You can now login with your new password.',
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
