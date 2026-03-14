import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, GET, PUT, DELETE, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'list';

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ success: false, message: 'Unauthorized' }, 401);

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) return json({ success: false, message: 'Unauthorized' }, 401);

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // ---- LIST NOTIFICATIONS ----
    if (action === 'list') {
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = parseInt(url.searchParams.get('offset') || '0');

      const { data, error, count } = await adminClient
        .from('notifications')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      // Count unread
      const { count: unreadCount } = await adminClient
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      return json({ success: true, data, total: count, unread_count: unreadCount || 0 });
    }

    // ---- MARK AS READ ----
    if (action === 'read') {
      if (req.method !== 'POST' && req.method !== 'PUT') return json({ success: false, message: 'POST/PUT required' }, 405);

      const body = await req.json();
      const { notification_id, read_all } = body;

      if (read_all) {
        await adminClient
          .from('notifications')
          .update({ is_read: true, read_at: new Date().toISOString() })
          .eq('user_id', user.id)
          .eq('is_read', false);
        return json({ success: true, message: 'All notifications marked as read' });
      }

      if (!notification_id) return json({ success: false, message: 'notification_id or read_all required' }, 400);

      const { error } = await adminClient
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', notification_id)
        .eq('user_id', user.id);

      if (error) throw error;
      return json({ success: true, message: 'Notification marked as read' });
    }

    // ---- DELETE ----
    if (action === 'delete') {
      if (req.method !== 'POST' && req.method !== 'DELETE') return json({ success: false, message: 'POST/DELETE required' }, 405);

      const body = await req.json();
      const { notification_id, delete_all_read } = body;

      if (delete_all_read) {
        await adminClient
          .from('notifications')
          .delete()
          .eq('user_id', user.id)
          .eq('is_read', true);
        return json({ success: true, message: 'All read notifications deleted' });
      }

      if (!notification_id) return json({ success: false, message: 'notification_id or delete_all_read required' }, 400);

      const { error } = await adminClient
        .from('notifications')
        .delete()
        .eq('id', notification_id)
        .eq('user_id', user.id);

      if (error) throw error;
      return json({ success: true, message: 'Notification deleted' });
    }

    // ---- UNREAD COUNT ----
    if (action === 'unread-count') {
      const { count } = await adminClient
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      return json({ success: true, data: { unread_count: count || 0 } });
    }

    return json({ success: false, message: 'Invalid action' }, 400);
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
