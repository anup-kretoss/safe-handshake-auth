import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  sendEmail,
  deliveryApprovedBuyerEmail,
  deliveryRejectedBuyerEmail,
  deliveryExpiredBuyerEmail,
} from "../_shared/mailer.ts";

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
    const url = new URL(req.url);
    let action = url.searchParams.get('action');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ success: false, message: 'Unauthorized' }, 401);

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Proper fix for all APIs: direct verification via admin client
    const token = authHeader.replace('Bearer ', '').trim();
    const { data: { user }, error: authError } = await adminClient.auth.getUser(token);

    if (authError || !user) {
      return json({ success: false, message: 'Invalid JWT or session expired' }, 401);
    }

    // Auto-expire pending requests and notify buyers
    const { data: expiredList } = await adminClient.rpc('expire_seller_delivery_requests');
    if (expiredList && expiredList.length > 0) {
      for (const item of expiredList) {
        // Fetch product details for the expired notification
        const { data: expiredProduct } = await adminClient
          .from('products')
          .select('id, title, images, price, condition, service_fee_percentage')
          .eq('id', item.product_id)
          .maybeSingle();

        const feePercent = expiredProduct?.service_fee_percentage || 12.5;
        const itemDisplayPrice = Math.ceil((expiredProduct?.price || 0) * (1 + feePercent / 100) * 100) / 100;

        await adminClient.from('notifications').insert({
          user_id: item.buyer_id,
          type: 'delivery_expired',
          title: '24-Hour Delivery Not Available',
          message: `The seller did not respond in time. Your order has been switched to standard delivery (AED 20). You can now proceed with payment.`,
          data: {
            order_id: item.order_id,
            product_id: item.product_id,
            order_status: 'pending',
            delivery_type: 'standard',
            delivery_price: 20,
            item_price: itemDisplayPrice,
            total_price: itemDisplayPrice + 20,
          },
        });

        // FCM push to buyer (no DB insert — already done above)
        try {
          const { data: buyerFcm } = await adminClient
            .from('profiles')
            .select('fcm_token')
            .eq('user_id', item.buyer_id)
            .maybeSingle();
          if (buyerFcm?.fcm_token) {
            await fetch(`${supabaseUrl}/functions/v1/notify-on-insert`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceRoleKey}` },
              body: JSON.stringify({
                fcm_token: buyerFcm.fcm_token,
                title: '24-Hour Delivery Not Available',
                body: 'Your order switched to standard delivery (AED 20). Tap to pay now.',
              }),
            });
          }
        } catch (_) { /* non-critical */ }
      }
    }

    let body: any = {};
    if (req.method === 'POST' || req.method === 'PUT') {
      try {
        body = await req.json();
        if (!action && body.action) action = body.action;
      } catch (_) { /* ignore parse error for empty body */ }
    }

    if (!action) action = 'list';

    // ---- LIST SELLER DELIVERY REQUESTS ----
    if (action === 'list') {
      const statusFilter = url.searchParams.get('status') || 'pending';
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = parseInt(url.searchParams.get('offset') || '0');

      // 1. Fetch only delivery requests
      let drQuery = adminClient
        .from('delivery_requests')
        .select('*', { count: 'exact' })
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (statusFilter !== 'all') {
        drQuery = drQuery.eq('status', statusFilter);
      }

      const { data: drList, error: drError, count } = await drQuery;
      if (drError) throw drError;

      // 2. Map and fetch related data manually
      const enrichedData = await Promise.all((drList || []).map(async (dr: any) => {
        // Fetch Order
        const { data: order } = await adminClient
          .from('orders')
          .select('*')
          .eq('id', dr.order_id)
          .maybeSingle();

        let productData = null;
        let buyerProfile = null;

        if (order) {
          // Fetch Product
          const { data: product } = await adminClient
            .from('products')
            .select('id, title, images, price')
            .eq('id', order.product_id)
            .maybeSingle();
          productData = product;

          // Fetch Buyer Profile
          const { data: profile } = await adminClient
            .from('profiles')
            .select('first_name, last_name, email, phone_number')
            .eq('user_id', order.buyer_id)
            .maybeSingle();
          buyerProfile = profile;
        }

        const now = new Date();
        const expiresAt = new Date(dr.expires_at);
        const remainingMs = Math.max(0, expiresAt.getTime() - now.getTime());

        return {
          ...dr,
          remaining_seconds: Math.floor(remainingMs / 1000),
          is_expired: remainingMs <= 0,
          remaining_minutes: Math.floor(remainingMs / (1000 * 60)),
          orders: order ? {
            ...order,
            products: productData,
            profiles: buyerProfile
          } : null
        };
      }));

      return json({
        success: true,
        data: enrichedData,
        total: count,
        stats: await getSellerStats(adminClient, user.id)
      });
    }

    // ---- APPROVE DELIVERY REQUEST (SELLER) ----
    if (action === 'approve') {
      const { delivery_request_id, seller_notes } = body;

      if (!delivery_request_id) {
        return json({ success: false, message: 'delivery_request_id is required' }, 400);
      }

      // 1. Fetch delivery request only
      const { data: dr, error: drError } = await adminClient
        .from('delivery_requests')
        .select('*')
        .eq('id', delivery_request_id)
        .eq('seller_id', user.id)
        .single();

      if (drError || !dr) {
        return json({ success: false, message: 'Delivery request not found' }, 404);
      }

      // 2. Fetch Order only
      const { data: order, error: orderError } = await adminClient
        .from('orders')
        .select('*')
        .eq('id', dr.order_id)
        .single();

      if (orderError || !order) {
        return json({ success: false, message: 'Associated order not found' }, 404);
      }

      // 3. Fetch Product for notification
      const { data: product } = await adminClient
        .from('products')
        .select('id, title, images, price, condition, service_fee_percentage')
        .eq('id', dr.product_id)
        .single();

      if (dr.status !== 'pending') {
        return json({ success: false, message: `Cannot approve: status is ${dr.status}` }, 400);
      }

      // Check if expired
      if (new Date(dr.expires_at) < new Date()) {
        await handleExpiredRequest(adminClient, { ...dr, orders: order, products: product });
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
        .eq('id', dr.order_id);

      // Notify buyer about approval
      await adminClient.from('notifications').insert({
        user_id: order.buyer_id,
        type: 'delivery_approved',
        title: '24-Hour Delivery Approved!',
        message: `Great news! Your 24-hour delivery request has been approved by the seller. You can now proceed with payment.`,
        data: {
          delivery_request_id,
          order_id: dr.order_id,
          product_id: dr.product_id,
          order_status: 'approved',
          delivery_type: '24hour',
          delivery_price: order.delivery_price,
          item_price: Math.ceil((product?.price || 0) * (1 + (product?.service_fee_percentage || 12.5) / 100) * 100) / 100,
          total_price: Math.ceil((product?.price || 0) * (1 + (product?.service_fee_percentage || 12.5) / 100) * 100) / 100 + order.delivery_price,
          seller_notes: seller_notes || null,
        },
      });

      // Send FCM push directly (no DB insert — already done above)
      try {
        const { data: buyerFcm } = await adminClient
          .from('profiles')
          .select('fcm_token')
          .eq('user_id', order.buyer_id)
          .maybeSingle();
        if (buyerFcm?.fcm_token) {
          await fetch(`${supabaseUrl}/functions/v1/notify-on-insert`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceRoleKey}` },
            body: JSON.stringify({
              fcm_token: buyerFcm.fcm_token,
              title: '24-Hour Delivery Approved!',
              body: 'Your delivery request has been approved. Tap to pay now.',
            }),
          });
        }
      } catch (_) { /* non-critical */ }

      // Send approval email to buyer (non-blocking)
      try {
        const { data: buyerAuth } = await adminClient.auth.admin.getUserById(order.buyer_id);
        const { data: buyerProfile } = await adminClient
          .from('profiles')
          .select('first_name, last_name')
          .eq('user_id', order.buyer_id)
          .maybeSingle();
        const buyerEmail = buyerAuth?.user?.email;
        const buyerName = buyerProfile
          ? `${buyerProfile.first_name} ${buyerProfile.last_name}`.trim()
          : 'there';
        if (buyerEmail) {
          sendEmail({
            to: buyerEmail,
            subject: `Your 24-Hour Delivery Request Has Been Approved — ${product?.title || 'Item'}`,
            html: deliveryApprovedBuyerEmail(buyerName, product?.title || 'Item', dr.order_id, seller_notes),
          }).catch((e) => console.error('[seller-delivery-requests/approve] email failed:', e));
        }
      } catch (_) { /* non-critical */ }

      return json({
        success: true,
        message: '24-hour delivery request approved successfully',
        data: { delivery_request_id, order_id: dr.order_id }
      });
    }

    // ---- REJECT DELIVERY REQUEST (SELLER) ----
    if (action === 'reject') {
      const { delivery_request_id, seller_notes } = body;

      if (!delivery_request_id) {
        return json({ success: false, message: 'delivery_request_id is required' }, 400);
      }

      // 1. Fetch delivery request only
      const { data: dr, error: drError } = await adminClient
        .from('delivery_requests')
        .select('*')
        .eq('id', delivery_request_id)
        .eq('seller_id', user.id)
        .single();

      if (drError || !dr) {
        return json({ success: false, message: 'Delivery request not found' }, 404);
      }

      // 2. Fetch Order only
      const { data: order, error: orderError } = await adminClient
        .from('orders')
        .select('*')
        .eq('id', dr.order_id)
        .single();

      if (orderError || !order) {
        return json({ success: false, message: 'Associated order not found' }, 404);
      }

      if (dr.status !== 'pending') {
        return json({ success: false, message: `Cannot reject: status is ${dr.status}` }, 400);
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
          status: 'pending',
          updated_at: new Date().toISOString(),
        })
        .eq('id', dr.order_id);

      // Fetch product for reject notification
      const { data: rejectProduct } = await adminClient
        .from('products')
        .select('id, title, images, price, condition, service_fee_percentage')
        .eq('id', dr.product_id)
        .maybeSingle();

      // Notify buyer about rejection
      await adminClient.from('notifications').insert({
        user_id: order.buyer_id,
        type: 'delivery_rejected',
        title: '24-Hour Delivery Not Available',
        message: `Sorry, the seller cannot provide 24-hour delivery at this time. Your order has been switched to standard delivery (AED 20). Please proceed with payment.`,
        data: {
          delivery_request_id,
          order_id: dr.order_id,
          product_id: dr.product_id,
          order_status: 'pending',
          delivery_type: 'standard',
          delivery_price: 20,
          item_price: Math.ceil((rejectProduct?.price || 0) * (1 + (rejectProduct?.service_fee_percentage || 12.5) / 100) * 100) / 100,
          total_price: Math.ceil((rejectProduct?.price || 0) * (1 + (rejectProduct?.service_fee_percentage || 12.5) / 100) * 100) / 100 + 20,
          reason: seller_notes || null,
        },
      });

      // Send FCM push directly (no DB insert — already done above)
      try {
        const { data: buyerFcm } = await adminClient
          .from('profiles')
          .select('fcm_token')
          .eq('user_id', order.buyer_id)
          .maybeSingle();
        if (buyerFcm?.fcm_token) {
          await fetch(`${supabaseUrl}/functions/v1/notify-on-insert`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceRoleKey}` },
            body: JSON.stringify({
              fcm_token: buyerFcm.fcm_token,
              title: '24-Hour Delivery Not Available',
              body: 'Your order has been switched to standard delivery (AED 20). Tap to pay now.',
            }),
          });
        }
      } catch (_) { /* non-critical */ }

      // Send rejection email to buyer (non-blocking)
      try {
        const { data: buyerAuth } = await adminClient.auth.admin.getUserById(order.buyer_id);
        const { data: buyerProfile } = await adminClient
          .from('profiles')
          .select('first_name, last_name')
          .eq('user_id', order.buyer_id)
          .maybeSingle();
        const { data: productRow } = await adminClient
          .from('products')
          .select('title')
          .eq('id', dr.product_id)
          .maybeSingle();
        const buyerEmail = buyerAuth?.user?.email;
        const buyerName = buyerProfile
          ? `${buyerProfile.first_name} ${buyerProfile.last_name}`.trim()
          : 'there';
        if (buyerEmail) {
          sendEmail({
            to: buyerEmail,
            subject: `24-Hour Delivery Unavailable — ${productRow?.title || 'Item'}`,
            html: deliveryRejectedBuyerEmail(buyerName, productRow?.title || 'Item', dr.order_id, seller_notes),
          }).catch((e) => console.error('[seller-delivery-requests/reject] email failed:', e));
        }
      } catch (_) { /* non-critical */ }

      return json({
        success: true,
        message: 'Request rejected and moved to standard delivery',
        data: { delivery_request_id, order_id: dr.order_id }
      });
    }

    // ---- GET SELLER STATS ----
    if (action === 'stats') {
      const stats = await getSellerStats(adminClient, user.id);
      return json({ success: true, data: stats });
    }

    return json({ success: false, message: 'Invalid action' }, 400);
  } catch (err: any) {
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
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Update delivery request to expired
  await adminClient
    .from('delivery_requests')
    .update({
      status: 'expired',
      updated_at: new Date().toISOString(),
    })
    .eq('id', deliveryRequest.id);

  // Update order to standard delivery - stay in pending so buyer can pay
  await adminClient
    .from('orders')
    .update({
      delivery_type: 'standard',
      delivery_price: 20,
      status: 'pending',
      updated_at: new Date().toISOString(),
    })
    .eq('id', deliveryRequest.order_id);

  const buyerId = deliveryRequest.orders?.buyer_id;
  const productId = deliveryRequest.orders?.products?.id || deliveryRequest.product_id;
  const productTitle = deliveryRequest.orders?.products?.title || 'Item';
  const productPrice = deliveryRequest.orders?.products?.price || 0;
  const feePercent = deliveryRequest.orders?.products?.service_fee_percentage || 12.5;
  const itemDisplayPrice = Math.ceil(productPrice * (1 + feePercent / 100) * 100) / 100;

  // Notify buyer about expiration with full details
  await adminClient.from('notifications').insert({
    user_id: buyerId,
    type: 'delivery_expired',
    title: '24-Hour Delivery Not Available',
    message: `The seller did not respond in time. Your order has been switched to standard delivery (AED 20). You can now proceed with payment.`,
    data: {
      delivery_request_id: deliveryRequest.id,
      order_id: deliveryRequest.order_id,
      product_id: productId,
      order_status: 'pending',
      delivery_type: 'standard',
      delivery_price: 20,
      item_price: itemDisplayPrice,
      total_price: itemDisplayPrice + 20,
    },
  });

  // FCM push (no DB insert — already done above)
  try {
    const { data: buyerFcm } = await adminClient
      .from('profiles')
      .select('fcm_token')
      .eq('user_id', buyerId)
      .maybeSingle();
    if (buyerFcm?.fcm_token) {
      await fetch(`${supabaseUrl}/functions/v1/notify-on-insert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceRoleKey}` },
        body: JSON.stringify({
          fcm_token: buyerFcm.fcm_token,
          title: '24-Hour Delivery Not Available',
          body: 'Your order switched to standard delivery (AED 20). Tap to pay now.',
        }),
      });
    }
  } catch (_) { /* non-critical */ }

  // Send expiry email to buyer (non-blocking)
  try {
    const { data: buyerAuth } = await adminClient.auth.admin.getUserById(buyerId);
    const { data: buyerProfile } = await adminClient
      .from('profiles')
      .select('first_name, last_name')
      .eq('user_id', buyerId)
      .maybeSingle();
    const productTitle = deliveryRequest.orders?.products?.title || 'Item';
    const buyerEmail = buyerAuth?.user?.email;
    const buyerName = buyerProfile
      ? `${buyerProfile.first_name} ${buyerProfile.last_name}`.trim()
      : 'there';
    if (buyerEmail) {
      sendEmail({
        to: buyerEmail,
        subject: `24-Hour Delivery Request Expired — ${productTitle}`,
        html: deliveryExpiredBuyerEmail(buyerName, productTitle, deliveryRequest.order_id),
      }).catch((e) => console.error('[seller-delivery-requests/expired] email failed:', e));
    }
  } catch (_) { /* non-critical */ }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}