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
    if (!body) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Request body is required',
        error_code: 'INVALID_BODY'
      }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { email, password, first_name, last_name, date_of_birth, country_code, phone_number } = body;

    // Validate required fields
    const errors: { field: string; message: string }[] = [];

    if (!email || typeof email !== 'string' || email.trim() === '') {
      errors.push({ field: 'email', message: 'Email is required' });
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        errors.push({ field: 'email', message: 'Invalid email format' });
      }
    }

    if (!password || typeof password !== 'string' || password.trim() === '') {
      errors.push({ field: 'password', message: 'Password is required' });
    } else if (password.length < 8) {
      errors.push({ field: 'password', message: 'Password must be at least 8 characters' });
    }

    if (!first_name || typeof first_name !== 'string' || first_name.trim() === '') {
      errors.push({ field: 'first_name', message: 'First name is required' });
    }

    if (!last_name || typeof last_name !== 'string' || last_name.trim() === '') {
      errors.push({ field: 'last_name', message: 'Last name is required' });
    }

    if (!date_of_birth || typeof date_of_birth !== 'string' || date_of_birth.trim() === '') {
      errors.push({ field: 'date_of_birth', message: 'Date of birth is required' });
    } else {
      // Validate date format (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(date_of_birth.trim())) {
        errors.push({ field: 'date_of_birth', message: 'Date of birth must be in YYYY-MM-DD format' });
      }
    }

    if (!country_code || typeof country_code !== 'string' || country_code.trim() === '') {
      errors.push({ field: 'country_code', message: 'Country code is required' });
    }

    if (!phone_number || typeof phone_number !== 'string' || phone_number.trim() === '') {
      errors.push({ field: 'phone_number', message: 'Phone number is required' });
    } else if (!/^\d{7,15}$/.test(phone_number.trim())) {
      errors.push({ field: 'phone_number', message: 'Phone number must be 7-15 digits' });
    }

    if (errors.length > 0) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Validation failed',
        error_code: 'VALIDATION_ERROR',
        errors,
      }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Check if email already exists
    const { data: existingUsers } = await adminClient.auth.admin.listUsers();
    const emailExists = existingUsers?.users?.some((u: any) => u.email === email.trim().toLowerCase());
    if (emailExists) {
      return new Response(JSON.stringify({
        success: false,
        message: 'An account with this email already exists',
        error_code: 'EMAIL_ALREADY_EXISTS'
      }), {
        status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if phone number already exists
    const { data: existingPhone } = await adminClient
      .from('profiles')
      .select('id')
      .eq('country_code', country_code.trim())
      .eq('phone_number', phone_number.trim())
      .limit(1);

    if (existingPhone && existingPhone.length > 0) {
      return new Response(JSON.stringify({
        success: false,
        message: 'An account with this phone number already exists',
        error_code: 'PHONE_ALREADY_EXISTS'
      }), {
        status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create user with admin API (auto-confirms email)
    const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password: password,
      email_confirm: true,
      user_metadata: {
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        date_of_birth: date_of_birth.trim(),
        country_code: country_code.trim(),
        phone_number: phone_number.trim(),
      },
    });

    if (createErr) {
      return new Response(JSON.stringify({
        success: false,
        message: createErr.message || 'Failed to create account',
        error_code: 'SIGNUP_FAILED'
      }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Sign in the user to get access token
    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY')!
    );

    const { data: session, error: signInErr } = await anonClient.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: password,
    });

    return new Response(JSON.stringify({
      success: true,
      message: 'Account created successfully',
      user: {
        id: newUser.user.id,
        email: newUser.user.email,
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        date_of_birth: date_of_birth.trim(),
        country_code: country_code.trim(),
        phone_number: phone_number.trim(),
      },
      session: session?.session ? {
        access_token: session.session.access_token,
        refresh_token: session.session.refresh_token,
        expires_in: session.session.expires_in,
        token_type: session.session.token_type,
      } : null,
    }), {
      status: 201,
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
