import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, GET, PUT, DELETE, OPTIONS',
};

// Maps each notification_settings field → the notification types it controls
const SETTING_TYPE_MAP: Record<string, string[]> = {
  general_notifications:  ['general'],
  message_notifications:  ['new_message', 'new_offer', 'offer_accepted', 'offer_rejected'],
  payment_notifications:  ['item_sold', 'payment_received', 'order_paid', 'order_shipped', 'order_delivered', 'order_cancelled', 'payment_confirmed'],
  update_notifications:   ['delivery_approved', 'delivery_rejected', 'delivery_expired'],
  // seller_delivery_request is ALWAYS shown — critical action required
};

function getDisabledTypes(settings: Record<string, boolean>): string[] {
  const disabled: string[] = [];
  for (const [key, types] of Object.entries(SETTING_TYPE_MAP)) {
    if (settings[key] === false) {
      disabled.push(...types);
    }
  }
  return disabled;
}

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
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ success: false, message: 'Unauthorized' }, 401);

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const token = authHeader.replace('Bearer ', '').trim();
    const { data: { user }, error: authError } = await adminClient.auth.getUser(token);
    if (authError || !user) {
      return json({ success: false, message: 'Invalid JWT or session expired' }, 401);
    }

    // ---- GET — List notifications filtered by user settings ----
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const limit      = parseInt(url.searchParams.get('limit')      || '50');
      const offset     = parseInt(url.searchParams.get('offset')     || '0');
      const unreadOnly = url.searchParams.get('unread_only') === 'true';

      // Fetch user notification settings
      const { data: settings } = await adminClient
        .from('notification_settings')
        .select('general_notifications, message_notifications, payment_notifications, update_notifications')
        .eq('user_id', user.id)
        .maybeSingle();

      const disabledTypes = settings ? getDisabledTypes(settings) : [];

      let query = adminClient
        .from('notifications')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id);

      if (unreadOnly) query = query.eq('is_read', false);

      if (disabledTypes.length > 0) {
        query = query.not('type', 'in', `(${disabledTypes.join(',')})`);
      }

      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        if (error.message?.includes('relation "notifications" does not exist')) {
          return json({ success: true, data: [], pagination: { limit, offset, total: 0 }, unread_count: 0 });
        }
        throw error;
      }

      // Unread count with same filter
      let unreadQuery = adminClient
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (disabledTypes.length > 0) {
        unreadQuery = unreadQuery.not('type', 'in', `(${disabledTypes.join(',')})`);
      }

      const { count: unreadCount } = await unreadQuery;

      // Enrich notifications with full product + seller + order details
      const enriched = await Promise.all((data || []).map(async (notif: any) => {
        const productId = notif.data?.product_id;
        const orderId = notif.data?.order_id;

        const [productResult, orderResult] = await Promise.all([
          productId
            ? adminClient
                .from('products')
                .select('id, title, images, price, condition, size, color, brand, material, location, description, service_fee_percentage, is_sold, seller_id, category_id, sub_category_id, created_at, categories(name), sub_categories(name, group_name)')
                .eq('id', productId)
                .maybeSingle()
            : Promise.resolve({ data: null }),
          orderId
            ? adminClient
                .from('orders')
                .select('id, status, delivery_type, delivery_price, created_at, shipping_address, mamo_payment_link_id')
                .eq('id', orderId)
                .maybeSingle()
            : Promise.resolve({ data: null }),
        ]);

        let product = null;
        if (productResult.data) {
          const p = productResult.data as any;
          const fee = p.service_fee_percentage || 12.5;

          // Fetch seller profile
          let seller = null;
          if (p.seller_id) {
            const { data: sellerProfile } = await adminClient
              .from('profiles')
              .select('user_id, first_name, last_name, profile_image')
              .eq('user_id', p.seller_id)
              .maybeSingle();
            if (sellerProfile) {
              seller = {
                user_id: sellerProfile.user_id,
                name: `${sellerProfile.first_name} ${sellerProfile.last_name}`.trim(),
                profile_image: sellerProfile.profile_image || null,
              };
            }
          }

          product = {
            ...p,
            actual_price: p.price,
            display_price: Math.ceil(p.price * (1 + fee / 100) * 100) / 100,
            seller,
          };
        }

        return {
          ...notif,
          product,
          order: orderResult.data || null,
        };
      }));

      return json({
        success: true,
        data: enriched,
        pagination: { limit, offset, total: count || 0 },
        unread_count: unreadCount || 0,
      });
    }

    // ---- PUT — Mark notification(s) as read ----
    if (req.method === 'PUT') {
      const body = await req.json();
      const { notification_id, mark_all_read } = body;

      if (mark_all_read) {
        const { error } = await adminClient
          .from('notifications')
          .update({ is_read: true, read_at: new Date().toISOString() })
          .eq('user_id', user.id)
          .eq('is_read', false);
        if (error) throw error;
        return json({ success: true, message: 'All notifications marked as read' });
      }

      if (!notification_id) {
        return json({ success: false, message: 'notification_id or mark_all_read is required' }, 400);
      }

      const { error } = await adminClient
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', notification_id)
        .eq('user_id', user.id);

      if (error) throw error;
      return json({ success: true, message: 'Notification marked as read' });
    }

    // ---- DELETE — Delete notification(s) ----
    if (req.method === 'DELETE') {
      const body = await req.json();
      const { notification_id, delete_all_read } = body;

      if (delete_all_read) {
        const { error } = await adminClient
          .from('notifications')
          .delete()
          .eq('user_id', user.id)
          .eq('is_read', true);
        if (error) throw error;
        return json({ success: true, message: 'All read notifications deleted' });
      }

      if (!notification_id) {
        return json({ success: false, message: 'notification_id or delete_all_read is required' }, 400);
      }

      const { error } = await adminClient
        .from('notifications')
        .delete()
        .eq('id', notification_id)
        .eq('user_id', user.id);

      if (error) throw error;
      return json({ success: true, message: 'Notification deleted' });
    }

    return json({ success: false, message: 'Method not allowed' }, 405);
  } catch (err: any) {
    return json({ success: false, message: err.message || 'Internal server error' }, 500);
  }
});
