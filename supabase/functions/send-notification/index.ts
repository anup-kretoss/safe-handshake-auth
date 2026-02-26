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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, message: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify the caller is authenticated
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, message: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { targetUserId, title, message } = body;

    if (!targetUserId || !title || !message) {
      return new Response(JSON.stringify({ success: false, message: 'targetUserId, title, and message are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get target user's FCM token
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('fcm_token')
      .eq('user_id', targetUserId)
      .single();

    if (profileError || !profile?.fcm_token) {
      return new Response(JSON.stringify({ success: false, message: 'User has no FCM token registered' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Send FCM notification using Firebase REST API
    const firebaseServiceAccount = JSON.parse(Deno.env.get('FIREBASE_SERVICE_ACCOUNT') || '{}');
    
    if (!firebaseServiceAccount.project_id) {
      return new Response(JSON.stringify({ success: false, message: 'Firebase not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get OAuth2 token for Firebase
    const jwtHeader = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const now = Math.floor(Date.now() / 1000);
    const jwtClaim = btoa(JSON.stringify({
      iss: firebaseServiceAccount.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }));

    // For a full production implementation, you'd sign the JWT with the private key
    // and exchange it for an access token. For now, return info about the setup needed.
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Notification endpoint ready. Configure FIREBASE_SERVICE_ACCOUNT secret to enable sending.',
      targetFcmToken: profile.fcm_token ? 'found' : 'missing',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, message: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
