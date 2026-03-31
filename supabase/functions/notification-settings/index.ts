import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, GET, PUT, OPTIONS',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ success: false, message: 'Unauthorized' }, 401);

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Verify user JWT directly
    const token = authHeader.replace('Bearer ', '').trim();
    const { data: { user }, error: authError } = await adminClient.auth.getUser(token);

    if (authError || !user) {
      return json({ success: false, message: 'Invalid JWT or session expired' }, 401);
    }

    // ---- GET NOTIFICATION SETTINGS ----
    if (req.method === 'GET') {
      const { data, error } = await adminClient
        .from('notification_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      // If no settings exist, return defaults and create them in background
      if (!data) {
        const defaultSettings = {
          user_id: user.id,
          general_notifications: true,
          email_notifications: true,
          message_notifications: true,
          payment_notifications: true,
          update_notifications: true,
        };

        // Return defaults immediately but also try to create in DB (upsert to avoid race conditions)
        adminClient.from('notification_settings').upsert(defaultSettings, { onConflict: 'user_id' }).then(({ error }: { error: any }) => {
          if (error) console.error('Auto-create notif settings error:', error);
        });

        return json({ success: true, data: defaultSettings });
      }

      return json({ success: true, data });
    }

    // ---- UPDATE NOTIFICATION SETTINGS ----
    if (req.method === 'PUT') {
      const body = await req.json();
      const updateData: any = {};
      const fields = ['general_notifications', 'email_notifications', 'message_notifications', 'payment_notifications', 'update_notifications'];

      for (const field of fields) {
        if (body[field] !== undefined) {
          updateData[field] = !!body[field];
        }
      }

      if (Object.keys(updateData).length === 0) {
        return json({ success: false, message: 'At least one notification setting must be provided' }, 400);
      }

      // Check if settings row exists first
      const { data: existing } = await adminClient
        .from('notification_settings')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      let data, error;

      if (existing) {
        // Row exists — update it
        ({ data, error } = await adminClient
          .from('notification_settings')
          .update({ ...updateData, updated_at: new Date().toISOString() })
          .eq('user_id', user.id)
          .select()
          .single());
      } else {
        // Row doesn't exist — insert it
        ({ data, error } = await adminClient
          .from('notification_settings')
          .insert({ user_id: user.id, ...updateData })
          .select()
          .single());
      }

      if (error) throw error;
      return json({ success: true, data, message: 'Notification settings updated successfully' });
    }

    // ---- CREATE NOTIFICATION SETTINGS ----
    if (req.method === 'POST') {
      const body = await req.json();
      const { data, error } = await adminClient
        .from('notification_settings')
        .insert({
          user_id: user.id,
          ...body
        })
        .select()
        .single();

      if (error) throw error;
      return json({ success: true, data, message: 'Notification settings created successfully' });
    }

    return json({ success: false, message: 'Method not allowed' }, 405);
  } catch (err: any) {
    console.error('Notification settings error:', err);
    return json({ success: false, message: err.message || 'Internal server error' }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}