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

    const { email, otp } = body;

    if (!email) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Email is required',
        error_code: 'MISSING_EMAIL'
      }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!otp) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'OTP is required',
        error_code: 'MISSING_OTP'
      }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (typeof otp !== 'string' || otp.length !== 4 || !/^\d{4}$/.test(otp)) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'OTP must be a 4-digit number',
        error_code: 'INVALID_OTP_FORMAT'
      }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Find the OTP record
    const { data: otpRecord, error: fetchErr } = await adminClient
      .from('password_reset_otps')
      .select('*')
      .eq('email', email)
      .eq('otp', otp)
      .eq('verified', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (fetchErr || !otpRecord) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Invalid OTP. Please check and try again.',
        error_code: 'INVALID_OTP'
      }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check expiry
    if (new Date(otpRecord.expires_at) < new Date()) {
      // Delete expired OTP
      await adminClient.from('password_reset_otps').delete().eq('id', otpRecord.id);
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'OTP has expired. Please request a new one.',
        error_code: 'OTP_EXPIRED'
      }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Mark as verified
    const { error: updateErr } = await adminClient
      .from('password_reset_otps')
      .update({ verified: true })
      .eq('id', otpRecord.id);

    if (updateErr) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Failed to verify OTP',
        error_code: 'VERIFICATION_FAILED'
      }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'OTP verified successfully. You can now set a new password.',
      reset_token: otpRecord.id,
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
