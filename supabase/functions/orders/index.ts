import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
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

    // ---- LIST BUYER ORDERS ----
    if (action === 'list') {
      const { data, error } = await adminClient
        .from('orders')
        .select('*, products(id, title, images, price, condition, service_fee_percentage, categories(name))')
        .eq('buyer_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const enriched = (data || []).map((o: any) => {
        if (o.products) {
          const feePercent = o.products.service_fee_percentage || 12.5;
          const displayPrice = Math.ceil(o.products.price * (1 + feePercent / 100) * 100) / 100;
          o.products.actual_price = o.products.price;
          o.products.display_price = displayPrice;
        }
        return o;
      });

      return json({ success: true, data: enriched });
    }

    // ---- LIST SELLER ORDERS ----
    if (action === 'seller-orders') {
      const { data, error } = await adminClient
        .from('orders')
        .select('*, products(id, title, images, price, condition, service_fee_percentage)')
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return json({ success: true, data });
    }

    // ---- CREATE ORDER (BUY PRODUCT) ----
    if (action === 'create') {
      if (req.method !== 'POST') return json({ success: false, message: 'POST required' }, 405);

      const body = await req.json();
      const { product_id, delivery_type, shipping_address } = body;

      if (!product_id) return json({ success: false, message: 'product_id is required' }, 400);

      // Validate shipping_address
      if (!shipping_address || typeof shipping_address !== 'object') {
        return json({ success: false, message: 'shipping_address is required with email, phone_number, address, town_city, postcode' }, 400);
      }
      const requiredFields = ['email', 'phone_number', 'address', 'town_city', 'postcode'];
      const missing = requiredFields.filter(f => !shipping_address[f] || String(shipping_address[f]).trim() === '');
      if (missing.length > 0) {
        return json({ success: false, message: `Shipping address missing required fields: ${missing.join(', ')}` }, 400);
      }

      // Get product details
      const { data: product, error: prodError } = await adminClient
        .from('products')
        .select('id, seller_id, is_sold, price, service_fee_percentage')
        .eq('id', product_id)
        .single();

      if (prodError || !product) return json({ success: false, message: 'Product not found' }, 404);
      if (product.is_sold) return json({ success: false, message: 'Product is already sold' }, 400);
      if (product.seller_id === user.id) return json({ success: false, message: 'Cannot buy your own product' }, 400);

      const validDeliveryType = delivery_type === '24hour' ? '24hour' : 'standard';
      const deliveryPrice = validDeliveryType === '24hour' ? 40 : 20;

      // If 24hour delivery requested, create a delivery request first
      if (validDeliveryType === '24hour') {
        // Create order in pending state
        const { data: order, error: orderError } = await adminClient
          .from('orders')
          .insert({
            buyer_id: user.id,
            product_id,
            seller_id: product.seller_id,
            delivery_type: '24hour',
            delivery_price: deliveryPrice,
            shipping_address,
            status: 'pending',
          })
          .select()
          .single();

        if (orderError) throw orderError;

        // Create delivery request with seller approval requirement (NOT admin)
        const { data: deliveryReq, error: drError } = await adminClient
          .from('delivery_requests')
          .insert({
            order_id: order.id,
            product_id,
            buyer_id: user.id,
            seller_id: product.seller_id,
            status: 'pending',
            requires_admin_approval: false, // SELLER APPROVAL ONLY
            admin_status: 'not_required',
            expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour for seller
          })
          .select()
          .single();

        if (drError) throw drError;

        // Create notification for buyer about seller review
        await adminClient.from('notifications').insert({
          user_id: user.id,
          type: 'delivery_request',
          title: '24-Hour Delivery Request Submitted',
          message: `Your 24-hour delivery request has been sent to the seller. You'll be notified within 1 hour.`,
          data: { order_id: order.id, delivery_request_id: deliveryReq.id, product_id },
        });

        // Create notification for seller
        await adminClient.from('notifications').insert({
          user_id: product.seller_id,
          type: 'seller_delivery_request',
          title: 'New 24-Hour Delivery Request',
          message: `A buyer wants 24-hour delivery for your item. Please respond within 1 hour or it will switch to standard delivery.`,
          data: { 
            order_id: order.id, 
            delivery_request_id: deliveryReq.id, 
            product_id,
            buyer_id: user.id
          },
        });

        // Send FCM notification to seller
        try {
          await fetch(`${supabaseUrl}/functions/v1/send-notification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceRoleKey}` },
            body: JSON.stringify({
              targetUserId: product.seller_id,
              title: 'New 24-Hour Delivery Request',
              message: 'A buyer wants 24-hour delivery. Please respond within 1 hour.',
            }),
          });
        } catch (_) { /* non-critical */ }

        return json({
          success: true,
          data: {
            order,
            delivery_request: deliveryReq,
            message: '24-hour delivery request sent to seller. You will be notified within 1 hour.',
            requires_seller_approval: true,
          },
        });
      }

      // Standard delivery - create order directly
      const { data: order, error: orderError } = await adminClient
        .from('orders')
        .insert({
          buyer_id: user.id,
          product_id,
          seller_id: product.seller_id,
          delivery_type: 'standard',
          delivery_price: deliveryPrice,
          shipping_address,
          status: 'paid',
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Mark product as sold
      await adminClient.from('products').update({ is_sold: true }).eq('id', product_id);

      // Notify seller
      await adminClient.from('notifications').insert({
        user_id: product.seller_id,
        type: 'item_sold',
        title: 'Item Sold!',
        message: `Your product has been purchased with standard delivery.`,
        data: { order_id: order.id, product_id },
      });

      return json({ success: true, data: { order, message: 'Order placed successfully with standard delivery.' } });
    }

    // ---- GET ORDER DETAIL ----
    if (action === 'detail') {
      const orderId = url.searchParams.get('id');
      if (!orderId) return json({ success: false, message: 'Order id is required' }, 400);

      const { data, error } = await adminClient
        .from('orders')
        .select('*, products(*, categories(name), sub_categories(name, group_name)), delivery_requests(*)')
        .eq('id', orderId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return json({ success: false, message: 'Order not found' }, 404);

      if (data.buyer_id !== user.id && data.seller_id !== user.id) {
        return json({ success: false, message: 'Not authorized' }, 403);
      }

      return json({ success: true, data });
    }

    // ---- UPDATE ORDER STATUS ----
    if (action === 'update-status') {
      if (req.method !== 'POST') return json({ success: false, message: 'POST required' }, 405);

      const body = await req.json();
      const { order_id, status } = body;

      if (!order_id || !status) return json({ success: false, message: 'order_id and status required' }, 400);

      const validStatuses = ['shipped', 'delivered', 'cancelled'];
      if (!validStatuses.includes(status)) {
        return json({ success: false, message: `status must be one of: ${validStatuses.join(', ')}` }, 400);
      }

      const { data: order, error: orderError } = await adminClient.from('orders').select('*').eq('id', order_id).maybeSingle();
      if (orderError) throw orderError;
      if (!order) return json({ success: false, message: 'Order not found' }, 404);

      // Sellers can ship, system/buyer can mark delivered
      if (status === 'shipped' && order.seller_id !== user.id) {
        return json({ success: false, message: 'Only seller can mark as shipped' }, 403);
      }

      const { data, error } = await adminClient
        .from('orders')
        .update({ status })
        .eq('id', order_id)
        .select()
        .single();

      if (error) throw error;

      // Send notifications
      const notifyUserId = status === 'shipped' ? order.buyer_id : order.seller_id;
      const notifTitle = status === 'shipped' ? 'Item Shipped' : status === 'delivered' ? 'Item Delivered' : 'Order Cancelled';
      await adminClient.from('notifications').insert({
        user_id: notifyUserId,
        type: `order_${status}`,
        title: notifTitle,
        message: `Order status updated to ${status}.`,
        data: { order_id },
      });

      return json({ success: true, data });
    }

    // ---- GET USER SHIPPING ADDRESSES (from orders) ----
    if (action === 'shipping-addresses') {
      const { data, error } = await adminClient
        .from('orders')
        .select('id, shipping_address, created_at')
        .eq('buyer_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return json({ success: true, data });
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
