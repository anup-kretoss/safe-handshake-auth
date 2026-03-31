import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, GET, PUT, DELETE, OPTIONS',
};

const SETTING_TYPE_MAP: Record<string, string[]> = {
  general_notifications:  ['general'],
  message_notifications:  ['new_message', 'new_offer', 'offer_accepted', 'offer_rejected'],
  payment_notifications:  ['item_sold', 'payment_received', 'order_paid', 'order_shipped', 'order_delivered', 'order_cancelled', 'payment_confirmed'],
  update_notifications:   ['delivery_approved', 'delivery_rejected', 'delivery_expired'],
  // seller_delivery_request is ALWAYS shown — it's a critical action required notification
};

function getDisabledTypes(settings: Record<string, boolean>): string[] {
  const disabled: string[] = [];
  for (const [key, types] of Object.entries(SETTING_TYPE_MAP)) {
    if (settings[key] === false) disabled.push(...types);
  }
  return disabled;
}

async function enrichWithProducts(notifications: any[], adminClient: any): Promise<any[]> {
  // Collect all product_ids (direct + via order)
  const directProductIds = new Set<string>(
    notifications.map((n: any) => n.data?.product_id).filter(Boolean)
  );

  const orderIds = new Set<string>(
    notifications
      .filter((n: any) => !n.data?.product_id && n.data?.order_id)
      .map((n: any) => n.data.order_id)
  );

  // Resolve product_ids from orders
  const orderProductMap: Record<string, string> = {};
  const orderDataMap: Record<string, any> = {};
  if (orderIds.size > 0) {
    const { data: orders } = await adminClient
      .from('orders')
      .select('id, product_id, status, delivery_type, delivery_price, created_at, shipping_address, mamo_payment_link_id')
      .in('id', [...orderIds]);
    for (const o of (orders || [])) {
      orderProductMap[o.id] = o.product_id;
      orderDataMap[o.id] = o;
      if (o.product_id) directProductIds.add(o.product_id);
    }
  }

  // Also fetch orders for notifications that have order_id directly
  const directOrderIds = new Set<string>(
    notifications.map((n: any) => n.data?.order_id).filter(Boolean)
  );
  const allOrderDataMap: Record<string, any> = { ...orderDataMap };
  if (directOrderIds.size > 0) {
    const { data: directOrders } = await adminClient
      .from('orders')
      .select('id, status, delivery_type, delivery_price, created_at, shipping_address, mamo_payment_link_id')
      .in('id', [...directOrderIds]);
    for (const o of (directOrders || [])) {
      allOrderDataMap[o.id] = o;
    }
  }

  // Build product map with full details
  const productMap: Record<string, any> = {};
  if (directProductIds.size > 0) {
    const { data: products } = await adminClient
      .from('products')
      .select('id, title, description, price, images, condition, brand, size, color, material, location, is_sold, service_fee_percentage, seller_id, category_id, sub_category_id, created_at, categories(name), sub_categories(name, group_name)')
      .in('id', [...directProductIds]);

    // Collect seller_ids for profile lookup
    const sellerIds = new Set<string>((products || []).map((p: any) => p.seller_id).filter(Boolean));
    const sellerMap: Record<string, any> = {};
    if (sellerIds.size > 0) {
      const { data: sellers } = await adminClient
        .from('profiles')
        .select('user_id, first_name, last_name, profile_image')
        .in('user_id', [...sellerIds]);
      for (const s of (sellers || [])) {
        sellerMap[s.user_id] = {
          user_id: s.user_id,
          name: `${s.first_name} ${s.last_name}`.trim(),
          profile_image: s.profile_image || null,
        };
      }
    }

    for (const p of (products || [])) {
      const fee = p.service_fee_percentage || 12.5;
      productMap[p.id] = {
        ...p,
        actual_price: p.price,
        display_price: Math.ceil(p.price * (1 + fee / 100) * 100) / 100,
        seller: sellerMap[p.seller_id] || null,
      };
    }
  }

  return notifications.map((n: any) => {
    let productId = n.data?.product_id;
    if (!productId && n.data?.order_id) {
      productId = orderProductMap[n.data.order_id];
    }

    const orderId = n.data?.order_id;

    return {
      ...n,
      product: productId ? (productMap[productId] || null) : null,
      order: orderId ? (allOrderDataMap[orderId] || null) : null,
    };
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'list';

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

    if (action === 'list') {
      const limit  = parseInt(url.searchParams.get('limit')  || '50');
      const offset = parseInt(url.searchParams.get('offset') || '0');

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

      if (disabledTypes.length > 0) {
        query = query.not('type', 'in', `(${disabledTypes.join(',')})`);
      }

      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      const enriched = await enrichWithProducts(data || [], adminClient);

      // No more auto-deleting orphans — notifications are kept even if product is deleted

      let unreadQuery = adminClient
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (disabledTypes.length > 0) {
        unreadQuery = unreadQuery.not('type', 'in', `(${disabledTypes.join(',')})`);
      }

      const { count: unreadCount } = await unreadQuery;

      return json({
        success: true,
        data: enriched,
        total: count || 0,
        unread_count: unreadCount || 0,
      });
    }

    if (action === 'read') {
      if (req.method !== 'POST' && req.method !== 'PUT') {
        return json({ success: false, message: 'POST or PUT required' }, 405);
      }
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
      if (!notification_id) {
        return json({ success: false, message: 'notification_id or read_all required' }, 400);
      }
      const { error } = await adminClient
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', notification_id)
        .eq('user_id', user.id);
      if (error) throw error;
      return json({ success: true, message: 'Notification marked as read' });
    }

    if (action === 'delete') {
      if (req.method !== 'POST' && req.method !== 'DELETE') {
        return json({ success: false, message: 'POST or DELETE required' }, 405);
      }
      const body = await req.json();
      const { notification_id, delete_all_read } = body;

      if (delete_all_read) {
        await adminClient.from('notifications').delete().eq('user_id', user.id).eq('is_read', true);
        return json({ success: true, message: 'All read notifications deleted' });
      }
      if (!notification_id) {
        return json({ success: false, message: 'notification_id or delete_all_read required' }, 400);
      }
      const { error } = await adminClient
        .from('notifications')
        .delete()
        .eq('id', notification_id)
        .eq('user_id', user.id);
      if (error) throw error;
      return json({ success: true, message: 'Notification deleted' });
    }

    if (action === 'unread-count') {
      const { data: settings } = await adminClient
        .from('notification_settings')
        .select('general_notifications, message_notifications, payment_notifications, update_notifications')
        .eq('user_id', user.id)
        .maybeSingle();

      const disabledTypes = settings ? getDisabledTypes(settings) : [];

      let q = adminClient
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (disabledTypes.length > 0) {
        q = q.not('type', 'in', `(${disabledTypes.join(',')})`);
      }

      const { count } = await q;
      return json({ success: true, data: { unread_count: count || 0 } });
    }

    if (action === 'update-fcm-token') {
      if (req.method !== 'POST') return json({ success: false, message: 'POST required' }, 405);
      const body = await req.json();
      const { fcm_token } = body;
      if (!fcm_token) return json({ success: false, message: 'fcm_token is required' }, 400);
      const { error } = await adminClient.from('profiles').update({ fcm_token }).eq('user_id', user.id);
      if (error) throw error;
      return json({ success: true, message: 'FCM token updated successfully' });
    }

    return json({ success: false, message: 'Invalid action' }, 400);
  } catch (err: any) {
    return json({ success: false, message: err.message || 'Internal server error' }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
