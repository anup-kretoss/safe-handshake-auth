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

    // Auto-expire pending requests
    await adminClient.rpc('expire_seller_delivery_requests');

    // ---- LIST SELLER DELIVERY REQUESTS ----
    if (action === 'list') {
      const status = url.searchParams.get('status') || 'pending';
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = parseInt(url.searchParams.get('offset') || '0');

      let query = adminClient
        .from('delivery_requests')
        .select(`
          *,
          orders!inner(
            *,
            products!inner(id, title, images, price),
            profiles!orders_buyer_id_fkey(first_name, last_name, email, phone_number)
          )
        `)
        .eq('seller_id', user.id)
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
        stats: await getSellerStats(adminClient, user.id)
      });
    }

    // ---- APPROVE DELIVERY REQUEST (SELLER) ----
    if (action === 'approve') {
      if (req.method !== 'POST') return json({ success: false, message: 'POST required' }, 405);

      const body = await req.json();
      const { delivery_request_id, seller_notes } = body;

      if (!delivery_request_id) {
        return json({ success: false, message: 'delivery_request_id is required' }, 400);
      }

      // Get the delivery request with related data
      const { data: deliveryRequest, error: drError } = await adminClient
        .from('delivery_requests')
        .select(`
          *,
          orders!inner(
            *,
            products!inner(id, title, seller_id),
            profiles!orders_buyer_id_fkey(first_name, last_name, email)
          )
        `)
        .eq('id', delivery_request_id)
        .eq('seller_id', user.id)
        .single();

      if (drError || !deliveryRequest) {
        return json({ success: false, message: 'Delivery request not found or not authorized' }, 404);
      }

      if (deliveryRequest.status !== 'pending') {
        return json({ success: false, message: `Cannot approve: status is ${deliveryRequest.status}` }, 400);
      }

      // Check if expired
      if (new Date(deliveryRequest.expires_at) < new Date()) {
        await handleExpiredRequest(adminClient, deliveryRequest);
        return json({ success: false, message: 'Request has expired and moved to standard delivery' }, 400);
      }

      // Approve the delivery request
      const { error: updateError } = await adminClient
        .from('delivery_requests')
        .update({
          status: 'approved',
          seller_notes: seller_notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', delivery_request_id);

      if (updateError) throw updateError;

      // Update order status to approved
      await adminClient
        .from('orders')
        .update({ 
          status: 'approved',
          updated_at: new Date().toISOString(),
        })
        .eq('id', deliveryRequest.order_id);

      // Notify buyer about approval
      await adminClient.from('notifications').insert({
        user_id: deliveryRequest.orders.buyer_id,
        type: 'delivery_approved',
        title: '24-Hour Delivery Approved!',
        message: `Great news! Your 24-hour delivery request has been approved by the seller. You can now proceed with payment.`,
        data: { 
          delivery_request_id,
          order_id: deliveryRequest.order_id,
          product_id: deliveryRequest.orders.products.id
        },
      });

      // Send FCM notification to buyer
      try {
        await fetch(`${supabaseUrl}/functions/v1/send-notification`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceRoleKey}` },
          body: JSON.stringify({
            targetUserId: deliveryRequest.orders.buyer_id,
            title: '24-Hour Delivery Approved!',
            message: 'Your delivery request has been approved by the seller.',
          }),
        });
      } catch (_) { /* non-critical */ }

      return json({ 
        success: true, 
        message: '24-hour delivery request approved successfully',
        data: { delivery_request_id, order_id: deliveryRequest.order_id }
      });
    }

    // ---- REJECT DELIVERY REQUEST (SELLER) ----
    if (action === 'reject') {
      if (req.method !== 'POST') return json({ success: false, message: 'POST required' }, 405);

      const body = await req.json();
      const { delivery_request_id, seller_notes } = body;

      if (!delivery_request_id) {
        return json({ success: false, message: 'delivery_request_id is required' }, 400);
      }

      // Get the delivery request with related data
      const { data: deliveryRequest, error: drError } = await adminClient
        .from('delivery_requests')
        .select(`
          *,
          orders!inner(
            *,
            products!inner(id, title, seller_id)
          )
        `)
        .eq('id', delivery_request_id)
        .eq('seller_id', user.id)
        .single();

      if (drError || !deliveryRequest) {
        return json({ success: false, message: 'Delivery request not found or not authorized' }, 404);
      }

      if (deliveryRequest.status !== 'pending') {
        return json({ success: false, message: `Cannot reject: status is ${deliveryRequest.status}` }, 400);
      }

      // Reject the delivery request
      const { error: updateError } = await adminClient
        .from('delivery_requests')
        .update({
          status: 'rejected',
          seller_notes: seller_notes || 'Request rejected by seller',
          updated_at: new Date().toISOString(),
        })
        .eq('id', delivery_request_id);

      if (updateError) throw updateError;

      // Update order to standard delivery
      await adminClient
        .from('orders')
        .update({ 
          delivery_type: 'standard',
          delivery_price: 20,
          status: 'paid',
          updated_at: new Date().toISOString(),
        })
        .eq('id', deliveryRequest.order_id);

      // Mark product as sold for standard delivery
      await adminClient
        .from('products')
        .update({ is_sold: true })
        .eq('id', deliveryRequest.orders.products.id);

      // Notify buyer about rejection and fallback
      await adminClient.from('notifications').insert({
        user_id: deliveryRequest.orders.buyer_id,
        type: 'delivery_rejected',
        title: '24-Hour Delivery Not Available',
        message: `Sorry, the seller cannot provide 24-hour delivery at this time. Your order has been switched to standard delivery (AED 20). ${seller_notes || ''}`,
        data: { 
          delivery_request_id,
          order_id: deliveryRequest.order_id,
          product_id: deliveryRequest.orders.products.id,
          reason: seller_notes
        },
      });

      // Send FCM notification to buyer
      try {
        await fetch(`${supabaseUrl}/functions/v1/send-notification`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceRoleKey}` },
          body: JSON.stringify({
            targetUserId: deliveryRequest.orders.buyer_id,
            title: '24-Hour Delivery Not Available',
            message: 'Your order has been switched to standard delivery.',
          }),
        });
      } catch (_) { /* non-critical */ }

      return json({ 
        success: true, 
        message: 'Request rejected and moved to standard delivery',
        data: { delivery_request_id, order_id: deliveryRequest.order_id }
      });
    }

    // ---- GET SELLER STATS ----
    if (action === 'stats') {
      const stats = await getSellerStats(adminClient, user.id);
      return json({ success: true, data: stats });
    }

    return json({ success: false, message: 'Invalid action' }, 400);
  } catch (err) {
    console.error('Seller delivery requests error:', err);
    return json({ success: false, message: err.message || 'Internal server error' }, 500);
  }
});

async function getSellerStats(adminClient: any, sellerId: string) {
  const [pendingResult, approvedResult, rejectedResult, expiredResult] = await Promise.all([
    adminClient.from('delivery_requests').select('id', { count: 'exact', head: true }).eq('seller_id', sellerId).eq('status', 'pending'),
    adminClient.from('delivery_requests').select('id', { count: 'exact', head: true }).eq('seller_id', sellerId).eq('status', 'approved'),
    adminClient.from('delivery_requests').select('id', { count: 'exact', head: true }).eq('seller_id', sellerId).eq('status', 'rejected'),
    adminClient.from('delivery_requests').select('id', { count: 'exact', head: true }).eq('seller_id', sellerId).eq('status', 'expired'),
  ]);

  return {
    pending: pendingResult.count || 0,
    approved: approvedResult.count || 0,
    rejected: rejectedResult.count || 0,
    expired: expiredResult.count || 0,
    total: (pendingResult.count || 0) + (approvedResult.count || 0) + (rejectedResult.count || 0) + (expiredResult.count || 0),
  };
}

async function handleExpiredRequest(adminClient: any, deliveryRequest: any) {
  // Update delivery request to expired
  await adminClient
    .from('delivery_requests')
    .update({
      status: 'expired',
      updated_at: new Date().toISOString(),
    })
    .eq('id', deliveryRequest.id);

  // Update order to standard delivery
  await adminClient
    .from('orders')
    .update({ 
      delivery_type: 'standard',
      delivery_price: 20,
      status: 'paid',
      updated_at: new Date().toISOString(),
    })
    .eq('id', deliveryRequest.order_id);

  // Mark product as sold
  await adminClient
    .from('products')
    .update({ is_sold: true })
    .eq('id', deliveryRequest.orders.products.id);

  // Notify buyer about expiration
  await adminClient.from('notifications').insert({
    user_id: deliveryRequest.orders.buyer_id,
    type: 'delivery_expired',
    title: '24-Hour Delivery Not Available',
    message: `24-hour delivery is not available at this time. Your order has been automatically switched to standard delivery (AED 20).`,
    data: { 
      delivery_request_id: deliveryRequest.id,
      order_id: deliveryRequest.order_id,
      product_id: deliveryRequest.orders.products.id
    },
  });
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}