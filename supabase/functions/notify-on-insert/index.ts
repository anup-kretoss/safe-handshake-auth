import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Internal function called by Postgres trigger via pg_net on notifications INSERT.
// No user JWT auth — we trust user_id directly from the DB row payload.

async function getAccessToken(): Promise<string> {
  const privateKeyPem = Deno.env.get('private_key') || '';
  const clientEmail   = Deno.env.get('client_email') || '';
  const tokenUri      = Deno.env.get('token_uri') || 'https://oauth2.googleapis.com/token';

  if (!privateKeyPem || !clientEmail) throw new Error('Firebase service account not configured');

  const now = Math.floor(Date.now() / 1000);
  const enc = new TextEncoder();
  const b64url = (d: Uint8Array) =>
    btoa(String.fromCharCode(...d)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const headerB64 = b64url(enc.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claimB64  = b64url(enc.encode(JSON.stringify({
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: tokenUri,
    iat: now,
    exp: now + 3600,
  })));
  const unsigned = `${headerB64}.${claimB64}`;

  const normalizedKey = privateKeyPem.replace(/\\n/g, '\n');
  const pemBody = normalizedKey
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s/g, '');

  const binaryKey = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    'pkcs8', binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  );
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(unsigned)));
  const jwt = `${unsigned}.${b64url(sig)}`;

  const resp = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const tokenData = await resp.json();
  if (!tokenData.access_token) throw new Error('Failed to get FCM access token: ' + JSON.stringify(tokenData));
  return tokenData.access_token;
}

serve(async (req) => {
  try {
    const row = await req.json();

    // user_id comes directly from the DB row — no JWT needed
    const userId  = row?.user_id;
    const title   = row?.title;
    const message = row?.message || '';

    if (!userId || !title) {
      return new Response(JSON.stringify({ skipped: true, reason: 'missing user_id or title' }), { status: 200 });
    }

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: profile } = await adminClient
      .from('profiles')
      .select('fcm_token')
      .eq('user_id', userId)
      .single();

    if (!profile?.fcm_token) {
      return new Response(JSON.stringify({ success: false, reason: 'no FCM token for user' }), { status: 200 });
    }

    const accessToken = await getAccessToken();
    const projectId   = Deno.env.get('project_id') || '';

    const fcmRes = await fetch(
      `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            token: profile.fcm_token,
            // notification key → OS shows push when app is background/closed
            notification: { title, body: message },
            // data key → foreground handler reads this
            data: {
              title,
              message,
              type: row.type || 'general',
              notification_id: String(row.id || ''),
            },
          },
        }),
      }
    );

    const fcmResult = await fcmRes.json();
    return new Response(JSON.stringify({ success: fcmRes.ok, fcmResult }), { status: 200 });

  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500 });
  }
});
