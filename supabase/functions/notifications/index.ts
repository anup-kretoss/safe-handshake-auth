import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, PUT, DELETE, OPTIONS',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!supabaseKey) {
      return json({ success: false, message: 'supabaseKey is required.' }, 500);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ success: false, message: 'Unauthorized' }, 401);
    }

    const authClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return json({ success: false, message: 'Unauthorized' }, 401);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // GET - List notifications
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = parseInt(url.searchParams.get('offset') || '0');
      const unreadOnly = url.searchParams.get('unread_only') === 'true';

      let query = adminClient
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (unreadOnly) {
        query = query.eq('is_read', false);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      // Get unread count
      const { count: unreadCount } = await adminClient
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      return json({
        success: true,
        data,
        pagination: {
          limit,
          offset,
          total: count || 0,
        },
        unread_count: unreadCount || 0,
      });
    }

    // PUT - Mark notification(s) as read
    if (req.method === 'PUT') {
      const body = await req.json();
      const { notification_id, mark_all_read } = body;

      if (mark_all_read) {
        // Mark all notifications as read
        const { error } = await adminClient
          .from('notifications')
          .update({ is_read: true, read_at: new Date().toISOString() })
          .eq('user_id', user.id)
          .eq('is_read', false);

        if (error) throw error;

        return json({ success: true, message: 'All notifications marked as read' });
      } else if (notification_id) {
        // Mark specific notification as read
        const { error } = await adminClient
          .from('notifications')
          .update({ is_read: true, read_at: new Date().toISOString() })
          .eq('id', notification_id)
          .eq('user_id', user.id);

        if (error) throw error;

        return json({ success: true, message: 'Notification marked as read' });
      } else {
        return json({ success: false, message: 'notification_id or mark_all_read is required' }, 400);
      }
    }

    // DELETE - Delete notification(s)
    if (req.method === 'DELETE') {
      const body = await req.json();
      const { notification_id, delete_all_read } = body;

      if (delete_all_read) {
        // Delete all read notifications
        const { error } = await adminClient
          .from('notifications')
          .delete()
          .eq('user_id', user.id)
          .eq('is_read', true);

        if (error) throw error;

        return json({ success: true, message: 'All read notifications deleted' });
      } else if (notification_id) {
        // Delete specific notification
        const { error } = await adminClient
          .from('notifications')
          .delete()
          .eq('id', notification_id)
          .eq('user_id', user.id);

        if (error) throw error;

        return json({ success: true, message: 'Notification deleted' });
      } else {
        return json({ success: false, message: 'notification_id or delete_all_read is required' }, 400);
      }
    }

    return json({ success: false, message: 'Method not allowed' }, 405);
  } catch (err) {
    console.error('Error:', err);
    return json({ success: false, message: err.message || 'Internal server error' }, 500);
  }
});
