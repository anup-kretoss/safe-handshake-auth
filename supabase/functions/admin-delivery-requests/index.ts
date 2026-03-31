// SELLER APPROVAL SYSTEM - Admin only manages platform, sellers approve 24h delivery
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, GET, PUT, OPTIONS',
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

    // Check if user is admin - Admin only manages platform, NOT delivery approvals
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile || !['admin', 'super_admin'].includes(profile.role)) {
      return json({ success: false, message: 'Admin access required - Platform management only' }, 403);
    }

    // Auto-expire pending requests
    await adminClient.rpc('expire_admin_delivery_requests');

    // ---- LIST ADMIN DELIVERY REQUESTS ----
    if (action === 'list') {
      const status = url.searchParams.get('status') || 'pending';
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = parseInt(url.searchParams.get('offset') || '0');

      let query = adminClient
        .from('admin_delivery_requests')
        .select(`
          *,
          delivery_requests!inner(
            *,
            orders!inner(
              *,
              products!inner(id, title, images, price, seller_id),
              profiles!orders_buyer_id_fkey(first_name, last_name, email)
            ),
            profiles!delivery_requests_seller_id_fkey(first_name, last_name, email)
          )
        `)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (status !== 'all') {
        query = query.eq('status', status);
      }

      const { data, error, count } = await query;
      if (error) throw error;

      // Calculate remaining time for pending requests
      const enrichedData = (data || []).map((item: any) => {
        const now = new Date();
        const expiresAt = new Date(item.expires_at);
        const remainingMs = Math.max(0, expiresAt.getTime() - now.getTime());
        
        return {
          ...item,
          remaining_seconds: Math.floor(remainingMs / 1000),
          is_expired: remainingMs <= 0,
          remaining_minutes: Math.floor(remainingMs / (1000 * 60)),
        };
      });

      return json({ 
        success: true, 
        data: enrichedData,
        total: count,
        stats: await getAdminStats(adminClient)
      });
    }

    // ---- APPROVE ADMIN DELIVERY REQUEST ----
    if (action === 'approve') {
      if (req.method !== 'POST') return json({ success: false, message: 'POST required' }, 405);

      const body = await req.json();
      const { admin_delivery_request_id, admin_notes } = body;

      if (!admin_delivery_request_id) {
        return json({ success: false, message: 'admin_delivery_request_id is required' }, 400);
      }

      // Get the admin delivery request with related data
      const { data: adminRequest, error: adminError } = await adminClient
        .from('admin_delivery_requests')
        .select(`
          *,
          delivery_requests!inner(
            *,
            orders!inner(*, products!inner(id, title, seller_id))
          )
        `)
        .eq('id', admin_delivery_request_id)
        .single();

      if (adminError || !adminRequest) {
        return json({ success: false, message: 'Admin delivery request not found' }, 404);
      }

      if (adminRequest.status !== 'pending') {
        return json({ success: false, message: `Cannot approve: status is ${adminRequest.status}` }, 400);
      }

      // Check if expired
      if (new Date(adminRequest.expires_at) < new Date()) {
        await handleExpiredRequest(adminClient, adminRequest);
        return json({ success: false, message: 'Request has expired and moved to standard delivery' }, 400);
      }

      // Approve the admin request
      const { error: updateError } = await adminClient
        .from('admin_delivery_requests')
        .update({
          status: 'approved',
          admin_id: user.id,
          admin_notes: admin_notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', admin_delivery_request_id);

      if (updateError) throw updateError;

      // Update delivery request status
      await adminClient
        .from('delivery_requests')
        .update({ 
          admin_status: 'approved',
          status: 'approved',
          updated_at: new Date().toISOString(),
        })
        .eq('id', adminRequest.delivery_request_id);

      // Update order status to approved
      await adminClient
        .from('orders')
        .update({ 
          status: 'approved',
          updated_at: new Date().toISOString(),
        })
        .eq('id', adminRequest.delivery_requests.order_id);

      // Notify buyer about approval
      await adminClient.from('notifications').insert({
        user_id: adminRequest.delivery_requests.orders.buyer_id,
        type: 'delivery_approved',
        title: '24-Hour Delivery Approved!',
        message: `Great news! Your 24-hour delivery request has been approved by our admin team. You can now proceed with payment.`,
        data: { 
          admin_delivery_request_id,
          delivery_request_id: adminRequest.delivery_request_id,
          order_id: adminRequest.delivery_requests.order_id,
          product_id: adminRequest.delivery_requests.orders.products.id
        },
      });

      // Notify seller about approval
      await adminClient.from('notifications').insert({
        user_id: adminRequest.delivery_requests.orders.products.seller_id,
        type: 'delivery_approved',
        title: '24-Hour Delivery Request Approved',
        message: `The 24-hour delivery request for "${adminRequest.delivery_requests.orders.products.title}" has been approved by admin. Please prepare for quick delivery.`,
        data: { 
          admin_delivery_request_id,
          delivery_request_id: adminRequest.delivery_request_id,
          order_id: adminRequest.delivery_requests.order_id,
          product_id: adminRequest.delivery_requests.orders.products.id
        },
      });

      // Send FCM notifications (direct, no DB insert)
      const buyerId = adminRequest.delivery_requests.orders.buyer_id;
      const sellerId = adminRequest.delivery_requests.orders.products.seller_id;
      for (const [uid, msg] of [[buyerId, 'Your delivery request has been approved. Tap to pay now.'], [sellerId, 'A delivery request has been approved by admin.']]) {
        try {
          const { data: fcmProfile } = await adminClient.from('profiles').select('fcm_token').eq('user_id', uid).maybeSingle();
          if (fcmProfile?.fcm_token) {
            await fetch(`${supabaseUrl}/functions/v1/notify-on-insert`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceRoleKey}` },
              body: JSON.stringify({ fcm_token: fcmProfile.fcm_token, title: '24-Hour Delivery Approved!', body: msg }),
            });
          }
        } catch (_) { /* non-critical */ }
      }

      return json({ 
        success: true, 
        message: '24-hour delivery request approved successfully',
        data: { admin_delivery_request_id, delivery_request_id: adminRequest.delivery_request_id }
      });
    }

    // ---- REJECT ADMIN DELIVERY REQUEST ----
    if (action === 'reject') {
      if (req.method !== 'POST') return json({ success: false, message: 'POST required' }, 405);

      const body = await req.json();
      const { admin_delivery_request_id, admin_notes } = body;

      if (!admin_delivery_request_id) {
        return json({ success: false, message: 'admin_delivery_request_id is required' }, 400);
      }

      // Get the admin delivery request with related data
      const { data: adminRequest, error: adminError } = await adminClient
        .from('admin_delivery_requests')
        .select(`
          *,
          delivery_requests!inner(
            *,
            orders!inner(*, products!inner(id, title, seller_id))
          )
        `)
        .eq('id', admin_delivery_request_id)
        .single();

      if (adminError || !adminRequest) {
        return json({ success: false, message: 'Admin delivery request not found' }, 404);
      }

      if (adminRequest.status !== 'pending') {
        return json({ success: false, message: `Cannot reject: status is ${adminRequest.status}` }, 400);
      }

      // Reject the admin request
      const { error: updateError } = await adminClient
        .from('admin_delivery_requests')
        .update({
          status: 'rejected',
          admin_id: user.id,
          admin_notes: admin_notes || 'Request rejected by admin',
          updated_at: new Date().toISOString(),
        })
        .eq('id', admin_delivery_request_id);

      if (updateError) throw updateError;

      // Update delivery request and order to standard delivery
      await adminClient
        .from('delivery_requests')
        .update({ 
          admin_status: 'rejected',
          status: 'rejected',
          updated_at: new Date().toISOString(),
        })
        .eq('id', adminRequest.delivery_request_id);

      await adminClient
        .from('orders')
        .update({ 
          delivery_type: 'standard',
          delivery_price: 20,
          status: 'paid',
          updated_at: new Date().toISOString(),
        })
        .eq('id', adminRequest.delivery_requests.order_id);

      // Mark product as sold for standard delivery
      await adminClient
        .from('products')
        .update({ is_sold: true })
        .eq('id', adminRequest.delivery_requests.orders.products.id);

      // Notify buyer about rejection and fallback
      await adminClient.from('notifications').insert({
        user_id: adminRequest.delivery_requests.orders.buyer_id,
        type: 'delivery_rejected',
        title: '24-Hour Delivery Not Available',
        message: `Sorry, 24-hour delivery is not available at this time. Your order has been switched to standard delivery (AED 20). ${admin_notes || ''}`,
        data: { 
          admin_delivery_request_id,
          delivery_request_id: adminRequest.delivery_request_id,
          order_id: adminRequest.delivery_requests.order_id,
          product_id: adminRequest.delivery_requests.orders.products.id,
          reason: admin_notes
        },
      });

      // Notify seller about standard delivery
      await adminClient.from('notifications').insert({
        user_id: adminRequest.delivery_requests.orders.products.seller_id,
        type: 'item_sold',
        title: 'Item Sold - Standard Delivery',
        message: `Your item "${adminRequest.delivery_requests.orders.products.title}" has been sold with standard delivery.`,
        data: { 
          order_id: adminRequest.delivery_requests.order_id,
          product_id: adminRequest.delivery_requests.orders.products.id
        },
      });

      return json({ 
        success: true, 
        message: 'Request rejected and moved to standard delivery',
        data: { admin_delivery_request_id, delivery_request_id: adminRequest.delivery_request_id }
      });
    }

    // ---- GET ADMIN STATS ----
    if (action === 'stats') {
      const stats = await getAdminStats(adminClient);
      return json({ success: true, data: stats });
    }

    return json({ success: false, message: 'Invalid action' }, 400);
  } catch (err) {
    console.error('Admin delivery requests error:', err);
    return json({ success: false, message: err.message || 'Internal server error' }, 500);
  }
});

async function getAdminStats(adminClient: any) {
  const [pendingResult, approvedResult, rejectedResult, expiredResult] = await Promise.all([
    adminClient.from('admin_delivery_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    adminClient.from('admin_delivery_requests').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
    adminClient.from('admin_delivery_requests').select('id', { count: 'exact', head: true }).eq('status', 'rejected'),
    adminClient.from('admin_delivery_requests').select('id', { count: 'exact', head: true }).eq('status', 'expired'),
  ]);

  return {
    pending: pendingResult.count || 0,
    approved: approvedResult.count || 0,
    rejected: rejectedResult.count || 0,
    expired: expiredResult.count || 0,
    total: (pendingResult.count || 0) + (approvedResult.count || 0) + (rejectedResult.count || 0) + (expiredResult.count || 0),
  };
}

async function handleExpiredRequest(adminClient: any, adminRequest: any) {
  // Update admin request to expired
  await adminClient
    .from('admin_delivery_requests')
    .update({
      status: 'expired',
      updated_at: new Date().toISOString(),
    })
    .eq('id', adminRequest.id);

  // Update delivery request and order to standard delivery
  await adminClient
    .from('delivery_requests')
    .update({ 
      admin_status: 'expired',
      status: 'expired',
      updated_at: new Date().toISOString(),
    })
    .eq('id', adminRequest.delivery_request_id);

  await adminClient
    .from('orders')
    .update({ 
      delivery_type: 'standard',
      delivery_price: 20,
      status: 'paid',
      updated_at: new Date().toISOString(),
    })
    .eq('id', adminRequest.delivery_requests.order_id);

  // Mark product as sold
  await adminClient
    .from('products')
    .update({ is_sold: true })
    .eq('id', adminRequest.delivery_requests.orders.products.id);

  // Notify buyer about expiration
  await adminClient.from('notifications').insert({
    user_id: adminRequest.delivery_requests.orders.buyer_id,
    type: 'delivery_expired',
    title: '24-Hour Delivery Not Available',
    message: `24-hour delivery is not available at this time. Your order has been automatically switched to standard delivery (AED 20).`,
    data: { 
      admin_delivery_request_id: adminRequest.id,
      delivery_request_id: adminRequest.delivery_request_id,
      order_id: adminRequest.delivery_requests.order_id,
      product_id: adminRequest.delivery_requests.orders.products.id
    },
  });

  // Notify seller
  await adminClient.from('notifications').insert({
    user_id: adminRequest.delivery_requests.orders.products.seller_id,
    type: 'item_sold',
    title: 'Item Sold - Standard Delivery',
    message: `Your item "${adminRequest.delivery_requests.orders.products.title}" has been sold with standard delivery.`,
    data: { 
      order_id: adminRequest.delivery_requests.order_id,
      product_id: adminRequest.delivery_requests.orders.products.id
    },
  });
}

async function sendFCMNotifications(adminClient: any, supabaseUrl: string, serviceRoleKey: string, data: any) {
  try {
    // Send to buyer
    await fetch(`${supabaseUrl}/functions/v1/send-notification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceRoleKey}` },
      body: JSON.stringify({
        targetUserId: data.buyerId,
        title: data.title,
        message: data.message,
      }),
    });

    // Send to seller
    await fetch(`${supabaseUrl}/functions/v1/send-notification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceRoleKey}` },
      body: JSON.stringify({
        targetUserId: data.sellerId,
        title: 'Delivery Request Update',
        message: 'A delivery request has been processed by admin.',
      }),
    });
  } catch (error) {
    console.error('FCM notification failed:', error);
  }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}