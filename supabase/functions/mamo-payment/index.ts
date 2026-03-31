import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  sendEmail,
  paymentSuccessBuyerEmail,
  paymentReceivedSellerFullEmail,
  paymentFailedBuyerEmail,
} from "../_shared/mailer.ts";
import { createIcarryOrder } from "../_shared/icarry.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

const MAMO_BASE_URL = 'https://sandbox.dev.business.mamopay.com/manage_api/v1';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const mamoApiKey = Deno.env.get('MAMO_API_KEY')!;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const getProfile = async (userId: string) => {
      const { data } = await adminClient.from('profiles').select('first_name, last_name').eq('user_id', userId).maybeSingle();
      const { data: authUser } = await adminClient.auth.admin.getUserById(userId);
      return {
        name: data ? `${data.first_name} ${data.last_name}`.trim() : 'User',
        email: authUser?.user?.email || '',
      };
    };

    const requireAuth = async () => {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) return { user: null, error: 'Unauthorized' };
      const token = authHeader.replace('Bearer ', '').trim();
      const { data: { user }, error } = await adminClient.auth.getUser(token);
      if (error || !user) return { user: null, error: 'Invalid token' };
      return { user, error: null };
    };

    // ----------------------------------------------------------------
    // CREATE PAYMENT LINK
    // Flow:
    //   Standard delivery  → order status must be 'pending'
    //   24h delivery       → delivery_request must be 'approved', 'rejected', or 'expired'
    //                        (still 'pending' = block, seller hasn't responded yet)
    //   Approved 24h       → pay at AED 40
    //   Rejected/Expired   → auto-switch to standard AED 20, then pay
    // ----------------------------------------------------------------
    if (action === 'create-link') {
      if (req.method !== 'POST') return json({ success: false, message: 'POST required' }, 405);

      const { user, error: authErr } = await requireAuth();
      if (!user) return json({ success: false, message: authErr }, 401);

      const { order_id, return_url, failure_return_url } = await req.json();
      if (!order_id) return json({ success: false, message: 'order_id is required' }, 400);

      const successUrl = return_url || null;
      const failureUrl = failure_return_url || null;

      // ---- CALCULATE TOTALS ----

      // Fetch order + product
      const { data: order, error: orderErr } = await adminClient
        .from('orders')
        .select('*, products(id, title, price, service_fee_percentage)')
        .eq('id', order_id)
        .eq('buyer_id', user.id)
        .single();

      if (orderErr || !order) return json({ success: false, message: 'Order not found or not authorized' }, 404);

      // Terminal states — cannot pay
      if (order.status === 'paid') {
        return json({ success: false, message: 'This order is already paid.' }, 400);
      }
      if (order.status === 'cancelled') {
        return json({ success: false, message: 'This order has been cancelled.' }, 400);
      }

      // ---- 24-HOUR DELIVERY GATE ----
      if (order.delivery_type === '24hour') {
        const { data: dr } = await adminClient
          .from('delivery_requests')
          .select('id, status, expires_at')
          .eq('order_id', order_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!dr) {
          return json({ success: false, message: 'No delivery request found for this 24h order.' }, 400);
        }

        if (dr.status === 'pending') {
          // Seller hasn't responded yet — block payment
          const remaining = Math.max(0, Math.floor(
            (new Date(dr.expires_at).getTime() - Date.now()) / 1000
          ));
          return json({
            success: false,
            message: 'Waiting for seller to approve or reject the 24-hour delivery request.',
            data: { delivery_request_status: 'pending', remaining_seconds: remaining },
          }, 400);
        }

        if (dr.status === 'approved') {
          // Seller approved — order status should be 'approved', pay at 24h rate
          if (order.status !== 'approved' && order.status !== 'pending_payment') {
            return json({
              success: false,
              message: `Order status is "${order.status}", expected "approved" to proceed with payment.`,
            }, 400);
          }
          // delivery_price stays AED 40 — fall through to payment
        }

        if (dr.status === 'rejected' || dr.status === 'expired') {
          // Switch to standard delivery (AED 20) if not already done
          if (order.delivery_price !== 20) {
            await adminClient
              .from('orders')
              .update({ delivery_type: 'standard', delivery_price: 20 })
              .eq('id', order_id);
            order.delivery_type = 'standard';
            order.delivery_price = 20;
          }
          // Fall through to payment at standard rate
        }
      }

      // ---- STANDARD DELIVERY GATE ----
      if (order.delivery_type === 'standard') {
        const allowedStatuses = ['pending', 'pending_payment'];
        if (!allowedStatuses.includes(order.status)) {
          return json({
            success: false,
            message: `Order status "${order.status}" is not payable.`,
          }, 400);
        }
      }

      // ---- IDEMPOTENT: already has an active Mamo link ----
      if (order.status === 'pending_payment' && order.mamo_payment_link_id) {
        const existingRes = await fetch(`${MAMO_BASE_URL}/links/${order.mamo_payment_link_id}`, {
          headers: { 'Authorization': `Bearer ${mamoApiKey}` },
        });
        const existing = await existingRes.json();
        if (existing.payment_url && existing.is_active) {
          return json({
            success: true,
            data: {
              order_id,
              payment_url: existing.payment_url,
              mamo_link_id: order.mamo_payment_link_id,
              requires_payment: true,
              message: 'Redirecting to payment...',
            },
          });
        }
      }

      // ---- CALCULATE TOTALS ----
      const feePercent = order.products?.service_fee_percentage || 12.5;
      const itemDisplayPrice = Math.ceil((order.products?.price || 0) * (1 + feePercent / 100) * 100) / 100;
      const deliveryPrice = order.delivery_price || 0;
      const totalPrice = itemDisplayPrice + deliveryPrice;

      // Mark order as pending_payment
      await adminClient.from('orders').update({ status: 'pending_payment' }).eq('id', order_id);

      // ---- CALL MAMO ----
      const mamoPayload: Record<string, unknown> = {
        title: `Souk IT — ${order.products?.title || 'Order'}`,
        amount: totalPrice,
        currency: 'AED',
        send_customer_receipt: true,
        is_active: true,
        custom_data: { order_id },
      };
      if (successUrl) mamoPayload.return_url = successUrl;
      if (failureUrl) mamoPayload.failure_return_url = failureUrl;

      console.log('[mamo-payment] payload:', JSON.stringify(mamoPayload));

      const mamoRes = await fetch(`${MAMO_BASE_URL}/links`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${mamoApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(mamoPayload),
      });

      const mamoData = await mamoRes.json();
      console.log('[mamo-payment] response:', mamoRes.status, JSON.stringify(mamoData));

      if (!mamoRes.ok || !mamoData.payment_url) {
        // Rollback status
        await adminClient.from('orders').update({ status: order.status }).eq('id', order_id);
        return json({
          success: false,
          message: 'Payment gateway error. Please try again.',
          debug: { mamo_status: mamoRes.status, mamo_error: mamoData },
        }, 502);
      }

      await adminClient.from('orders').update({ mamo_payment_link_id: mamoData.id }).eq('id', order_id);

      return json({
        success: true,
        data: {
          order_id,
          payment_url: mamoData.payment_url,
          mamo_link_id: mamoData.id,
          item_price: itemDisplayPrice,
          delivery_price: deliveryPrice,
          total_price: totalPrice,
          requires_payment: true,
          message: 'Redirecting to payment...',
        },
      });
    }

    // ----------------------------------------------------------------
    // VERIFY PAYMENT
    // Called from /payment-callback after Mamo redirects back.
    // ALWAYS re-checks with Mamo's charges API — never trusts redirect params alone.
    // Only marks paid if Mamo confirms status === 'captured'.
    // ----------------------------------------------------------------
    if (action === 'verify') {
      if (req.method !== 'POST') return json({ success: false, message: 'POST required' }, 405);

      const { user, error: authErr } = await requireAuth();
      if (!user) return json({ success: false, message: authErr }, 401);

      const { order_id, transaction_id, payment_link_id } = await req.json();
      if (!order_id) return json({ success: false, message: 'order_id is required' }, 400);

      const { data: order, error: orderErr } = await adminClient
        .from('orders')
        .select('*, products(id, title, price, service_fee_percentage)')
        .eq('id', order_id)
        .eq('buyer_id', user.id)
        .single();

      if (orderErr || !order) return json({ success: false, message: 'Order not found' }, 404);

      // Idempotent — webhook may have already marked it paid
      if (order.status === 'paid') {
        return json({ success: true, data: order, message: 'Payment already confirmed.' });
      }

      if (order.status !== 'pending_payment') {
        return json({ success: false, message: `Order status is "${order.status}", cannot verify payment.` }, 400);
      }

      // ---- ALWAYS re-verify with Mamo API — never trust redirect params alone ----
      let paymentCaptured = false;
      const chargeId = transaction_id; // Mamo appends transactionId to redirect URL

      if (chargeId) {
        const verifyRes = await fetch(`${MAMO_BASE_URL}/charges/${chargeId}`, {
          headers: { 'Authorization': `Bearer ${mamoApiKey}` },
        });
        const verifyData = await verifyRes.json();
        console.log('[mamo-payment/verify] charge response:', JSON.stringify(verifyData));
        // Only captured = paid. failed/pending/refunded = not paid.
        paymentCaptured = verifyData.status === 'captured';
      } else {
        // Fallback: check via payment link id (from redirect or stored on order)
        const linkId = payment_link_id || order.mamo_payment_link_id;
        if (!linkId) {
          return json({ success: false, message: 'No transaction ID or payment link ID available to verify.' }, 400);
        }
        const linkRes = await fetch(`${MAMO_BASE_URL}/links/${linkId}`, {
          headers: { 'Authorization': `Bearer ${mamoApiKey}` },
        });
        const linkData = await linkRes.json();
        console.log('[mamo-payment/verify] link response:', JSON.stringify(linkData));
        paymentCaptured = linkData.charges?.some((c: any) => c.status === 'captured') ?? false;
      }

      // ---- Mamo did NOT confirm capture — do NOT update status, send failure email ----
      if (!paymentCaptured) {
        console.error(`[mamo-payment/verify] Mamo did not confirm capture for order ${order_id}`);

        const feePercent = order.products?.service_fee_percentage || 12.5;
        const itemDisplayPrice = Math.ceil((order.products?.price || 0) * (1 + feePercent / 100) * 100) / 100;
        const totalPrice = itemDisplayPrice + (order.delivery_price || 0);

        getProfile(user.id).then(({ name, email }) => {
          if (email) sendEmail({
            to: email,
            subject: `Payment Failed — ${order.products?.title}`,
            html: paymentFailedBuyerEmail(name, order.products?.title || 'Item', totalPrice, order_id, 'Payment was not confirmed by the payment provider. Please try again.'),
          });
        }).catch(console.error);

        return json({
          success: false,
          message: 'Payment was not successful. Your order has not been updated.',
        }, 402);
      }

      // ---- Mamo confirmed capture — mark order as PAID ----
      const { data: updatedOrder, error: updateError } = await adminClient
        .from('orders')
        .update({
          status: 'paid',
          mamo_transaction_id: chargeId || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', order_id)
        .select()
        .single();

      if (updateError) throw updateError;

      await adminClient.from('products').update({ is_sold: true }).eq('id', order.product_id);

      const feePercent = order.products?.service_fee_percentage || 12.5;
      const itemDisplayPrice = Math.ceil((order.products?.price || 0) * (1 + feePercent / 100) * 100) / 100;
      const deliveryPrice = order.delivery_price || 0;
      const totalPrice = itemDisplayPrice + deliveryPrice;

      await adminClient.from('notifications').insert({
        user_id: order.seller_id,
        type: 'item_sold',
        title: 'Payment Received!',
        message: `Payment confirmed for "${order.products?.title}". Total: AED ${totalPrice}.`,
        data: { order_id, product_id: order.product_id },
      });
      await adminClient.from('notifications').insert({
        user_id: user.id,
        type: 'payment_confirmed',
        title: 'Payment Successful!',
        message: `Your payment for "${order.products?.title}" was successful. Total: AED ${totalPrice}.`,
        data: { order_id, product_id: order.product_id },
      });

      getProfile(user.id).then(({ name, email }) => {
        if (email) sendEmail({
          to: email,
          subject: `Payment Successful — ${order.products?.title}`,
          html: paymentSuccessBuyerEmail(name, order.products?.title || 'Item', itemDisplayPrice, deliveryPrice, totalPrice, order.delivery_type, order_id, chargeId || undefined),
        });
      }).catch(console.error);

      getProfile(order.seller_id).then(({ name, email }) => {
        if (email) sendEmail({
          to: email,
          subject: `Payment Received for "${order.products?.title}"`,
          html: paymentReceivedSellerFullEmail(name, order.products?.title || 'Item', itemDisplayPrice, deliveryPrice, totalPrice, order.delivery_type, order_id, chargeId || undefined),
        });
      }).catch(console.error);

      // Auto-create iCarry order inline (non-blocking)
      createIcarryOrder(adminClient, order_id).catch(
        (e) => console.error('[mamo-payment/verify] iCarry failed:', e.message)
      );

      return json({
        success: true,
        data: { ...updatedOrder, item_price: itemDisplayPrice, delivery_price: deliveryPrice, total_price: totalPrice },
        message: 'Payment completed successfully.',
      });
    }

    return json({ success: false, message: 'Invalid action' }, 400);
  } catch (err: any) {
    console.error('[mamo-payment] error:', err);
    return json({ success: false, message: err.message || 'Internal server error' }, 500);
  }
});
