import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  sendEmail,
  paymentSuccessBuyerEmail,
  paymentReceivedSellerFullEmail,
  paymentFailedBuyerEmail,
} from "../_shared/mailer.ts";
import { createIcarryOrder } from "../_shared/icarry.ts";

// Mamo POSTs to this endpoint when a payment is captured or fails.
// No user auth needed — Mamo calls this server-to-server.
// We verify the payment independently via Mamo's charges API before updating anything.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
  if (req.method !== 'POST') return json({ success: false, message: 'POST required' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const mamoApiKey = Deno.env.get('MAMO_API_KEY')!;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    console.log('[mamo-webhook] received:', JSON.stringify(body));

    // Mamo webhook payload fields
    // status: 'captured' | 'failed' | 'refunded' | ...
    // id: charge/transaction id  (MPB-CHRG-...)
    // payment_link_id: the link id (MB-LINK-...)
    // custom_data: { order_id: '...' }  — what we set when creating the link
    const { status, id: chargeId, payment_link_id, custom_data } = body;

    // Extract order_id from custom_data
    const orderId = typeof custom_data === 'object'
      ? custom_data?.order_id
      : null;

    if (!orderId) {
      console.error('[mamo-webhook] no order_id in custom_data:', custom_data);
      // Return 200 so Mamo doesn't keep retrying for non-order webhooks
      return json({ success: true, message: 'No order_id, ignored.' });
    }

    // ---- Only process 'captured' status ----
    if (status !== 'captured') {
      console.log(`[mamo-webhook] status="${status}" for order ${orderId} — not captured, skipping.`);

      // Send failure email to buyer for explicit 'failed' status
      if (status === 'failed') {
        const { data: order } = await adminClient
          .from('orders')
          .select('buyer_id, products(title, price, service_fee_percentage), delivery_price')
          .eq('id', orderId)
          .single();

        if (order) {
          const feePercent = (order.products as any)?.service_fee_percentage || 12.5;
          const itemDisplayPrice = Math.ceil(((order.products as any)?.price || 0) * (1 + feePercent / 100) * 100) / 100;
          const totalPrice = itemDisplayPrice + (order.delivery_price || 0);

          const getProfile = async (userId: string) => {
            const { data } = await adminClient.from('profiles').select('first_name, last_name').eq('user_id', userId).maybeSingle();
            const { data: authUser } = await adminClient.auth.admin.getUserById(userId);
            return {
              name: data ? `${data.first_name} ${data.last_name}`.trim() : 'User',
              email: authUser?.user?.email || '',
            };
          };

          getProfile(order.buyer_id).then(({ name, email }) => {
            if (email) sendEmail({
              to: email,
              subject: `Payment Failed — ${(order.products as any)?.title}`,
              html: paymentFailedBuyerEmail(name, (order.products as any)?.title || 'Item', totalPrice, orderId, 'Payment was declined by the payment provider.'),
            });
          }).catch(console.error);
        }
      }

      return json({ success: true, message: `Status "${status}" received, no action taken.` });
    }

    // ---- Re-verify with Mamo's charges API (never trust webhook alone) ----
    let verified = false;

    if (chargeId) {
      const verifyRes = await fetch(`${MAMO_BASE_URL}/charges/${chargeId}`, {
        headers: { 'Authorization': `Bearer ${mamoApiKey}` },
      });
      const verifyData = await verifyRes.json();
      console.log('[mamo-webhook] charge verify:', JSON.stringify(verifyData));
      verified = verifyData.status === 'captured';
    } else if (payment_link_id) {
      const linkRes = await fetch(`${MAMO_BASE_URL}/links/${payment_link_id}`, {
        headers: { 'Authorization': `Bearer ${mamoApiKey}` },
      });
      const linkData = await linkRes.json();
      console.log('[mamo-webhook] link verify:', JSON.stringify(linkData));
      verified = linkData.charges?.some((c: any) => c.status === 'captured') ?? false;
    }

    if (!verified) {
      console.error(`[mamo-webhook] Mamo API did NOT confirm capture for order ${orderId}. Ignoring.`);
      return json({ success: false, message: 'Payment not verified with Mamo API.' }, 400);
    }

    // ---- Fetch order ----
    const { data: order, error: orderErr } = await adminClient
      .from('orders')
      .select('*, products(id, title, price, service_fee_percentage)')
      .eq('id', orderId)
      .single();

    if (orderErr || !order) {
      console.error('[mamo-webhook] order not found:', orderId);
      return json({ success: false, message: 'Order not found.' }, 404);
    }

    // Idempotent — already paid
    if (order.status === 'paid') {
      console.log(`[mamo-webhook] order ${orderId} already paid, skipping.`);
      return json({ success: true, message: 'Already paid.' });
    }

    if (order.status !== 'pending_payment') {
      console.error(`[mamo-webhook] unexpected order status "${order.status}" for order ${orderId}`);
      return json({ success: false, message: `Unexpected order status: ${order.status}` }, 400);
    }

    // ---- Mark order as PAID ----
    const { error: updateError } = await adminClient
      .from('orders')
      .update({
        status: 'paid',
        mamo_transaction_id: chargeId || null,
        mamo_payment_link_id: order.mamo_payment_link_id || payment_link_id || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (updateError) throw updateError;

    // Mark product as sold
    await adminClient.from('products').update({ is_sold: true }).eq('id', order.product_id);

    // Price breakdown
    const feePercent = order.products?.service_fee_percentage || 12.5;
    const itemDisplayPrice = Math.ceil((order.products?.price || 0) * (1 + feePercent / 100) * 100) / 100;
    const deliveryPrice = order.delivery_price || 0;
    const totalPrice = itemDisplayPrice + deliveryPrice;

    // Notifications
    await adminClient.from('notifications').insert({
      user_id: order.seller_id,
      type: 'item_sold',
      title: 'Payment Received!',
      message: `Payment confirmed for "${order.products?.title}". Total: AED ${totalPrice}.`,
      data: { order_id: orderId, product_id: order.product_id },
    });
    await adminClient.from('notifications').insert({
      user_id: order.buyer_id,
      type: 'payment_confirmed',
      title: 'Payment Successful!',
      message: `Your payment for "${order.products?.title}" was successful. Total: AED ${totalPrice}.`,
      data: { order_id: orderId, product_id: order.product_id },
    });

    // Emails (non-blocking)
    const getProfile = async (userId: string) => {
      const { data } = await adminClient.from('profiles').select('first_name, last_name').eq('user_id', userId).maybeSingle();
      const { data: authUser } = await adminClient.auth.admin.getUserById(userId);
      return {
        name: data ? `${data.first_name} ${data.last_name}`.trim() : 'User',
        email: authUser?.user?.email || '',
      };
    };

    getProfile(order.buyer_id).then(({ name, email }) => {
      if (email) sendEmail({
        to: email,
        subject: `Payment Successful — ${order.products?.title}`,
        html: paymentSuccessBuyerEmail(name, order.products?.title || 'Item', itemDisplayPrice, deliveryPrice, totalPrice, order.delivery_type, orderId, chargeId || undefined),
      });
    }).catch(console.error);

    getProfile(order.seller_id).then(({ name, email }) => {
      if (email) sendEmail({
        to: email,
        subject: `Payment Received for "${order.products?.title}"`,
        html: paymentReceivedSellerFullEmail(name, order.products?.title || 'Item', itemDisplayPrice, deliveryPrice, totalPrice, order.delivery_type, orderId, chargeId || undefined),
      });
    }).catch(console.error);

    console.log(`[mamo-webhook] order ${orderId} marked as PAID successfully.`);

    // Auto-create iCarry order inline (non-blocking)
    createIcarryOrder(adminClient, orderId).catch(
      (e) => console.error('[mamo-webhook] iCarry failed:', e.message)
    );

    return json({ success: true, message: 'Payment confirmed and order updated.' });

  } catch (err: any) {
    console.error('[mamo-webhook] error:', err);
    return json({ success: false, message: err.message || 'Internal server error' }, 500);
  }
});
