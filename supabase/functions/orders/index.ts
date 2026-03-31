import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  sendEmail,
  orderPlacedBuyerEmail,
  orderReceivedSellerEmail,
  deliveryRequestEmail,
  orderShippedEmail,
  orderDeliveredEmail,
  orderCancelledEmail,
  paymentReceivedSellerEmail,
} from "../_shared/mailer.ts";

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
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ success: false, message: 'Unauthorized' }, 401);

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const token = authHeader.replace('Bearer ', '').trim();
    const { data: { user }, error: authError } = await adminClient.auth.getUser(token);

    if (authError || !user) {
      return json({ success: false, message: 'Invalid JWT or session expired' }, 401);
    }

    // Helper: fetch profile (name + email) for a user id
    const getProfile = async (userId: string) => {
      const { data } = await adminClient
        .from('profiles')
        .select('first_name, last_name')
        .eq('user_id', userId)
        .maybeSingle();
      const { data: authUser } = await adminClient.auth.admin.getUserById(userId);
      return {
        name: data ? `${data.first_name} ${data.last_name}`.trim() : 'User',
        email: authUser?.user?.email || '',
      };
    };

    // ---- LIST ORDERS (Bought/Sold) ----
    if (action === 'list') {
      const type = url.searchParams.get('type') || 'bought';
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = parseInt(url.searchParams.get('offset') || '0');

      let query = adminClient
        .from('orders')
        .select('*, products(id, title, images, price, condition, service_fee_percentage, categories(name))')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (type === 'sold') {
        query = query.eq('seller_id', user.id);
      } else {
        query = query.eq('buyer_id', user.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      const enriched = await Promise.all((data || []).map(async (o: any) => {
        // Calculate price breakdown
        if (o.products) {
          const feePercent = o.products.service_fee_percentage || 12.5;
          const itemPrice = Math.ceil(o.products.price * (1 + feePercent / 100) * 100) / 100;
          o.products.actual_price = o.products.price;
          o.products.display_price = itemPrice;
          // Total = item display price + delivery fee
          o.total_price = itemPrice + (o.delivery_price || 0);
        }

        // Attach delivery request info for 24h orders
        if (o.delivery_type === '24hour' || (o.delivery_type === 'standard' && o.status === 'pending')) {
          const { data: dr } = await adminClient
            .from('delivery_requests')
            .select('id, status, expires_at')
            .eq('order_id', o.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (dr) {
            o.delivery_request_status = dr.status; // pending | approved | rejected | expired
            o.delivery_request_id = dr.id;

            if (dr.status === 'pending') {
              const now = new Date();
              const expires = new Date(dr.expires_at);
              o.remaining_seconds = Math.max(0, Math.floor((expires.getTime() - now.getTime()) / 1000));
            }
          }
        }

        return o;
      }));

      return json({ success: true, data: enriched, type });
    }

    // ---- CREATE ORDER (BUY PRODUCT) ----
    if (action === 'create') {
      if (req.method !== 'POST') return json({ success: false, message: 'POST required' }, 405);

      const body = await req.json();
      const { product_id, delivery_type, delivery_address_id } = body;

      if (!product_id) return json({ success: false, message: 'product_id is required' }, 400);
      if (!delivery_address_id) return json({ success: false, message: 'delivery_address_id is required' }, 400);

      // Resolve shipping address from buyer's saved addresses
      const { data: buyerProfile } = await adminClient
        .from('profiles')
        .select('delivery_address')
        .eq('user_id', user.id)
        .single();

      const savedAddresses: any[] = (() => {
        const raw = buyerProfile?.delivery_address;
        if (!raw) return [];
        if (Array.isArray(raw)) return raw;
        if (typeof raw === 'object') return [{ id: 'legacy', ...raw }];
        return [];
      })();

      const found = savedAddresses.find((a: any) => a.id === delivery_address_id);
      if (!found) return json({ success: false, message: `delivery_address_id "${delivery_address_id}" not found in your saved delivery addresses.` }, 404);

      const shipping_address = { ...found, delivery_address_id };

      const { data: product, error: prodError } = await adminClient
        .from('products')
        .select('id, title, images, condition, seller_id, is_sold, price, service_fee_percentage')
        .eq('id', product_id)
        .single();

      if (prodError || !product) return json({ success: false, message: 'Product not found' }, 404);
      if (product.is_sold) return json({ success: false, message: 'Product is already sold' }, 400);
      if (product.seller_id === user.id) return json({ success: false, message: 'Cannot buy your own product' }, 400);

      const feePercent = product.service_fee_percentage || 12.5;
      const itemDisplayPrice = Math.ceil(product.price * (1 + feePercent / 100) * 100) / 100;

      const validDeliveryType = delivery_type === '24hour' ? '24hour' : 'standard';
      const deliveryPrice = validDeliveryType === '24hour' ? 40 : 20;
      const totalPrice = itemDisplayPrice + deliveryPrice;

      // 24-hour delivery — needs seller approval first
      if (validDeliveryType === '24hour') {
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

        const { data: deliveryReq, error: drError } = await adminClient
          .from('delivery_requests')
          .insert({
            order_id: order.id,
            product_id,
            buyer_id: user.id,
            seller_id: product.seller_id,
            status: 'pending',
            expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          })
          .select()
          .single();

        if (drError) throw drError;

        await adminClient.from('notifications').insert({
          user_id: product.seller_id,
          type: 'seller_delivery_request',
          title: '24-Hour Delivery Requested',
          message: `A buyer requested 24-hour delivery for "${product.title}". You have 1 hour to approve or it switches to standard delivery (AED 20).`,
          data: { order_id: order.id, delivery_request_id: deliveryReq.id, product_id },
        });
        // FCM push handled automatically by Postgres trigger on notifications insert

        // Send email to seller about delivery request (non-blocking)
        getProfile(product.seller_id).then(({ name, email }) => {
          if (email) sendEmail({
            to: email,
            subject: `24-Hour Delivery Request for "${product.title}"`,
            html: deliveryRequestEmail(name, product.title, order.id),
          });
        }).catch((e) => console.error("[orders/create] delivery request email failed:", e));

        // Send order confirmation email to buyer (non-blocking)
        getProfile(user.id).then(({ name, email: buyerEmail }) => {
          if (buyerEmail) sendEmail({
            to: buyerEmail,
            subject: `Order Placed — ${product.title}`,
            html: orderPlacedBuyerEmail(name, product.title, itemDisplayPrice, deliveryPrice, totalPrice, '24hour', order.id),
          });
        }).catch((e) => console.error("[orders/create] buyer email failed:", e));

        return json({
          success: true,
          data: {
            order: { ...order, products: product },
            delivery_request: deliveryReq,
            item_price: itemDisplayPrice,
            delivery_price: deliveryPrice,
            total_price: totalPrice,
            message: '24-hour delivery request sent to seller. Awaiting approval (1 hour window).',
            requires_seller_approval: true,
          },
        });
      }

      // Standard delivery — create order as 'pending', payment handled by mamo-payment
      const { data: order, error: orderError } = await adminClient
        .from('orders')
        .insert({
          buyer_id: user.id,
          product_id,
          seller_id: product.seller_id,
          delivery_type: 'standard',
          delivery_price: deliveryPrice,
          shipping_address,
          status: 'pending',
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // No notifications or emails here — those fire only after Mamo confirms payment
      // via mamo-payment?action=verify or the mamo-webhook function

      return json({
        success: true,
        data: {
          order: { ...order, products: product },
          item_price: itemDisplayPrice,
          delivery_price: deliveryPrice,
          total_price: totalPrice,
          message: 'Order created. Proceed to payment.',
        },
      });
    }

    // ---- COMPLETE PAYMENT (only for approved or expired/rejected → standard) ----
    if (action === 'complete-payment') {
      if (req.method !== 'POST') return json({ success: false, message: 'POST required' }, 405);

      const body = await req.json();
      const { order_id } = body;

      if (!order_id) return json({ success: false, message: 'order_id is required' }, 400);

      const { data: order, error } = await adminClient
        .from('orders')
        .select('*, products(id, title, price, service_fee_percentage)')
        .eq('id', order_id)
        .eq('buyer_id', user.id)
        .single();

      if (error || !order) return json({ success: false, message: 'Order not found or not authorized' }, 404);

      // Only allow payment for:
      // 1. status = 'approved' (seller approved 24h delivery)
      // 2. status = 'pending' AND delivery_type = 'standard'
      //    (happens when 24h was rejected/expired and switched to standard)
      const canPay =
        order.status === 'approved' ||
        (order.status === 'pending' && order.delivery_type === 'standard');

      if (!canPay) {
        if (order.status === 'pending' && order.delivery_type === '24hour') {
          return json({
            success: false,
            message: 'Payment not allowed yet. Waiting for seller to approve or reject the 24-hour delivery request.',
          }, 400);
        }
        return json({
          success: false,
          message: `Cannot pay for order with status "${order.status}". Only approved or pending-standard orders can be paid.`,
        }, 400);
      }

      // Calculate price breakdown
      const feePercent = order.products?.service_fee_percentage || 12.5;
      const itemDisplayPrice = Math.ceil((order.products?.price || 0) * (1 + feePercent / 100) * 100) / 100;
      const deliveryPrice = order.delivery_price || 0;
      const totalPrice = itemDisplayPrice + deliveryPrice;

      const { data: updatedOrder, error: updateError } = await adminClient
        .from('orders')
        .update({ status: 'paid', updated_at: new Date().toISOString() })
        .eq('id', order_id)
        .select()
        .single();

      if (updateError) throw updateError;

      await adminClient.from('products').update({ is_sold: true }).eq('id', order.product_id);

      // Notify seller
      await adminClient.from('notifications').insert({
        user_id: order.seller_id,
        type: 'item_sold',
        title: 'Payment Received!',
        message: `Payment confirmed for "${order.products?.title}". Item price: AED ${itemDisplayPrice}, Delivery: AED ${deliveryPrice}, Total: AED ${totalPrice}.`,
        data: { order_id, product_id: order.product_id },
      });

      // Send payment confirmation email to seller (non-blocking)
      getProfile(order.seller_id).then(({ name, email: sellerEmail }) => {
        if (sellerEmail) sendEmail({
          to: sellerEmail,
          subject: `Payment Received for "${order.products?.title}"`,
          html: paymentReceivedSellerEmail(name, order.products?.title || 'Item', itemDisplayPrice, deliveryPrice, totalPrice, order_id),
        });
      }).catch((e) => console.error("[orders/complete-payment] seller email failed:", e));

      // Auto-create iCarry shipment order (non-blocking)
      createIcarryOrderForPaidOrder(order_id, supabaseUrl, serviceRoleKey, authHeader!).catch(
        (e) => console.error("[orders/complete-payment] iCarry auto-create failed:", e)
      );

      return json({
        success: true,
        data: {
          ...updatedOrder,
          item_price: itemDisplayPrice,
          delivery_price: deliveryPrice,
          total_price: totalPrice,
        },
        message: 'Payment completed successfully.',
      });
    }

    // ---- GET ORDER DETAIL ----
    if (action === 'detail') {
      const orderId = url.searchParams.get('id');
      if (!orderId) return json({ success: false, message: 'Order id is required' }, 400);

      const { data, error } = await adminClient
        .from('orders')
        .select('*, products(*, categories(name)), delivery_requests(*)')
        .eq('id', orderId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return json({ success: false, message: 'Order not found' }, 404);

      if (data.buyer_id !== user.id && data.seller_id !== user.id) {
        return json({ success: false, message: 'Not authorized' }, 403);
      }

      // Price breakdown
      if (data.products) {
        const feePercent = data.products.service_fee_percentage || 12.5;
        const itemDisplayPrice = Math.ceil(data.products.price * (1 + feePercent / 100) * 100) / 100;
        data.products.display_price = itemDisplayPrice;
        data.total_price = itemDisplayPrice + (data.delivery_price || 0);
      }

      // Countdown for pending delivery request
      if (data.delivery_requests && data.delivery_requests.length > 0) {
        const lastReq = data.delivery_requests[data.delivery_requests.length - 1];
        data.delivery_request_status = lastReq.status;
        if (lastReq.status === 'pending') {
          const now = new Date();
          const expires = new Date(lastReq.expires_at);
          data.remaining_seconds = Math.max(0, Math.floor((expires.getTime() - now.getTime()) / 1000));
        }
      }

      return json({ success: true, data });
    }

    // ---- CREATE ICARRY SHIPMENT (auto-called after payment, or manually by seller) ----
    if (action === 'create-icarry-shipment') {
      if (req.method !== 'POST') return json({ success: false, message: 'POST required' }, 405);

      const body = await req.json();
      const { order_id } = body;
      if (!order_id) return json({ success: false, message: 'order_id is required' }, 400);

      const { data: order, error: orderErr } = await adminClient
        .from('orders')
        .select('*, products(id, title, price, images, pickup_address, seller_id)')
        .eq('id', order_id)
        .maybeSingle();

      if (orderErr || !order) return json({ success: false, message: 'Order not found' }, 404);
      if (order.seller_id !== user.id && order.buyer_id !== user.id) {
        return json({ success: false, message: 'Not authorized' }, 403);
      }
      if (order.status !== 'paid') {
        return json({ success: false, message: `Order must be paid before creating shipment. Current status: ${order.status}` }, 400);
      }
      if (order.icarry_shipment_id) {
        return json({
          success: true,
          message: 'iCarry shipment already exists',
          data: {
            icarry_shipment_id: order.icarry_shipment_id,
            icarry_awb: order.icarry_awb,
            icarry_tracking_url: order.icarry_tracking_url,
          },
        });
      }

      // Delegate to icarry function
      const icarryUrl = `${supabaseUrl}/functions/v1/icarry?action=create-shipment`;
      const icarryRes = await fetch(icarryUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader!,
          'apikey': Deno.env.get('SUPABASE_ANON_KEY') || '',
        },
        body: JSON.stringify({ order_id }),
      });
      const icarryData = await icarryRes.json();
      return new Response(JSON.stringify(icarryData), {
        status: icarryRes.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ---- TRACK ICARRY SHIPMENT ----
    if (action === 'track-shipment') {
      const orderId = url.searchParams.get('id');
      if (!orderId) return json({ success: false, message: 'id (order_id) is required' }, 400);

      const { data: order } = await adminClient
        .from('orders')
        .select('id, icarry_awb, icarry_shipment_id, icarry_tracking_url, buyer_id, seller_id')
        .eq('id', orderId)
        .maybeSingle();

      if (!order) return json({ success: false, message: 'Order not found' }, 404);
      if (order.buyer_id !== user.id && order.seller_id !== user.id) {
        return json({ success: false, message: 'Not authorized' }, 403);
      }
      if (!order.icarry_awb) {
        return json({ success: false, message: 'No iCarry shipment found for this order. Shipment may not have been created yet.' }, 404);
      }

      const icarryUrl = `${supabaseUrl}/functions/v1/icarry?action=track&awb=${order.icarry_awb}`;
      const icarryRes = await fetch(icarryUrl, {
        headers: { 'apikey': Deno.env.get('SUPABASE_ANON_KEY') || '' },
      });
      const trackingData = await icarryRes.json();

      return json({
        success: true,
        data: {
          order_id: orderId,
          icarry_awb: order.icarry_awb,
          icarry_shipment_id: order.icarry_shipment_id,
          icarry_tracking_url: order.icarry_tracking_url,
          tracking: trackingData.data?.tracking || trackingData.data,
        },
      });
    }

    // ---- MARK AS READY FOR PICKUP (SELLER) ----
    if (action === 'mark-pickup-ready') {
      if (req.method !== 'POST') return json({ success: false, message: 'POST required' }, 405);

      const body = await req.json();
      const { order_id } = body;

      const { data: order, error } = await adminClient
        .from('orders')
        .select('*')
        .eq('id', order_id)
        .eq('seller_id', user.id)
        .single();

      if (error || !order) return json({ success: false, message: 'Order not found' }, 404);

      const { data: updated, error: uError } = await adminClient
        .from('orders')
        .update({
          picked_up_at: new Date().toISOString(),
          status: 'shipped',
          delivery_timer_started_at: new Date().toISOString(),
        })
        .eq('id', order_id)
        .select()
        .single();

      if (uError) throw uError;

      return json({ success: true, data: updated, message: 'Item marked as picked up. Delivery timer started.' });
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

      const notifyUserId = status === 'shipped' ? order.buyer_id : order.seller_id;
      const notifTitle = status === 'shipped' ? 'Item Shipped' : status === 'delivered' ? 'Item Delivered' : 'Order Cancelled';

      // Fetch product_id for notification
      const { data: orderForNotif } = await adminClient
        .from('orders')
        .select('product_id, products(title, images, price, service_fee_percentage)')
        .eq('id', order_id)
        .maybeSingle();

      const notifProductId = orderForNotif?.product_id || null;
      const notifProduct = (orderForNotif as any)?.products;
      const notifFee = notifProduct?.service_fee_percentage || 12.5;
      const notifItemPrice = Math.ceil((notifProduct?.price || 0) * (1 + notifFee / 100) * 100) / 100;

      await adminClient.from('notifications').insert({
        user_id: notifyUserId,
        type: `order_${status}`,
        title: notifTitle,
        message: `Order status updated to ${status}.`,
        data: {
          order_id,
          product_id: notifProductId,
          status,
          item_price: notifItemPrice,
        },
      });

      // Fetch product title for email
      const { data: orderDetail } = await adminClient
        .from('orders')
        .select('products(title), buyer_id, seller_id')
        .eq('id', order_id)
        .maybeSingle();
      const productTitle = (orderDetail as any)?.products?.title || 'Item';

      if (status === 'shipped') {
        getProfile(order.buyer_id).then(({ name, email: buyerEmail }) => {
          if (buyerEmail) sendEmail({
            to: buyerEmail,
            subject: `Your order has been shipped — ${productTitle}`,
            html: orderShippedEmail(name, productTitle, order_id),
          });
        }).catch((e) => console.error("[orders/update-status] shipped email failed:", e));
      } else if (status === 'delivered') {
        getProfile(order.buyer_id).then(({ name, email: buyerEmail }) => {
          if (buyerEmail) sendEmail({
            to: buyerEmail,
            subject: `Order Delivered — ${productTitle}`,
            html: orderDeliveredEmail(name, productTitle, order_id),
          });
        }).catch((e) => console.error("[orders/update-status] delivered email failed:", e));
      } else if (status === 'cancelled') {
        // Notify both buyer and seller
        getProfile(order.buyer_id).then(({ name, email: buyerEmail }) => {
          if (buyerEmail) sendEmail({
            to: buyerEmail,
            subject: `Order Cancelled — ${productTitle}`,
            html: orderCancelledEmail(name, productTitle, order_id, true),
          });
        }).catch((e) => console.error("[orders/update-status] cancelled buyer email failed:", e));
        getProfile(order.seller_id).then(({ name, email: sellerEmail }) => {
          if (sellerEmail) sendEmail({
            to: sellerEmail,
            subject: `Order Cancelled — ${productTitle}`,
            html: orderCancelledEmail(name, productTitle, order_id, false),
          });
        }).catch((e) => console.error("[orders/update-status] cancelled seller email failed:", e));
      }

      return json({ success: true, data });
    }

    // ---- GET USER SHIPPING ADDRESSES ----
    if (action === 'shipping-addresses') {
      const { data, error } = await adminClient
        .from('orders')
        .select('id, shipping_address, created_at')
        .eq('buyer_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return json({ success: true, data });
    }

    // ---- UPDATE ORDER DELIVERY ADDRESS ----
    if (action === 'update') {
      if (req.method !== 'POST') return json({ success: false, message: 'POST required' }, 405);

      const body = await req.json();
      const { order_id, delivery_address_id } = body;

      if (!order_id) return json({ success: false, message: 'order_id is required' }, 400);
      if (!delivery_address_id) return json({ success: false, message: 'delivery_address_id is required' }, 400);

      // Verify order belongs to buyer and is still pending
      const { data: order, error: orderErr } = await adminClient
        .from('orders')
        .select('id, status, buyer_id')
        .eq('id', order_id)
        .eq('buyer_id', user.id)
        .single();

      if (orderErr || !order) return json({ success: false, message: 'Order not found or not authorized' }, 404);
      if (!['pending', 'approved'].includes(order.status)) {
        return json({ success: false, message: `Cannot update delivery address for order with status "${order.status}". Only pending or approved orders can be updated.` }, 400);
      }

      // Resolve the delivery address from profile
      const { data: buyerProfile } = await adminClient
        .from('profiles')
        .select('delivery_address')
        .eq('user_id', user.id)
        .single();

      const savedAddresses: any[] = (() => {
        const raw = buyerProfile?.delivery_address;
        if (!raw) return [];
        if (Array.isArray(raw)) return raw;
        if (typeof raw === 'object') return [{ id: 'legacy', ...raw }];
        return [];
      })();

      const found = savedAddresses.find((a: any) => a.id === delivery_address_id);
      if (!found) return json({ success: false, message: `delivery_address_id "${delivery_address_id}" not found in your saved delivery addresses.` }, 404);

      const { data: updated, error: updateErr } = await adminClient
        .from('orders')
        .update({ shipping_address: { ...found, delivery_address_id }, updated_at: new Date().toISOString() })
        .eq('id', order_id)
        .select()
        .single();

      if (updateErr) throw updateErr;

      return json({ success: true, message: 'Delivery address updated successfully', data: updated });
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

// ---- iCarry auto-create helper (called non-blocking after payment) ----
async function createIcarryOrderForPaidOrder(
  orderId: string,
  supabaseUrl: string,
  serviceRoleKey: string,
  authHeader: string
) {
  const icarryUrl = `${supabaseUrl}/functions/v1/icarry?action=create-order`;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  const res = await fetch(icarryUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authHeader,
      'apikey': anonKey,
    },
    body: JSON.stringify({ order_id: orderId }),
  });
  const data = await res.json();
  if (!data.success) {
    console.error(`[iCarry auto-create] order ${orderId} failed:`, data.message);
  } else {
    console.log(`[iCarry auto-create] order ${orderId} created. Tracking: ${data.data?.icarry_tracking_number}`);
  }
}
