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

    // ---- LIST DELIVERY REQUESTS ----
    if (action === 'list') {
      const { data, error } = await adminClient
        .from('delivery_requests')
        .select('*, orders(*, products(id, title, images, price))')
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Auto-expire pending requests past their expiry
      const now = new Date();
      for (const dr of (data || [])) {
        if (dr.status === 'pending' && new Date(dr.expires_at) < now) {
          await adminClient.from('delivery_requests').update({ status: 'expired' }).eq('id', dr.id);
          // Fallback order to standard delivery
          if (dr.order_id) {
            await adminClient.from('orders').update({ delivery_type: 'standard', delivery_price: 20 }).eq('id', dr.order_id);
          }
          // Notify buyer
          await adminClient.from('notifications').insert({
            user_id: dr.buyer_id,
            type: 'delivery_expired',
            title: 'Delivery Request Expired',
            message: '24-hour delivery request expired. Standard delivery will be used.',
            data: { delivery_request_id: dr.id, order_id: dr.order_id },
          });
          dr.status = 'expired';
        }
      }

      return json({ success: true, data });
    }

    // ---- APPROVE DELIVERY REQUEST (Seller only) ----
    if (action === 'approve') {
      if (req.method !== 'POST') return json({ success: false, message: 'POST required' }, 405);

      const body = await req.json();
      const { delivery_request_id } = body;
      if (!delivery_request_id) return json({ success: false, message: 'delivery_request_id required' }, 400);

      const { data: drs, error: drError } = await adminClient
        .from('delivery_requests')
        .select('*')
        .eq('id', delivery_request_id);

      if (drError) throw drError;
      const dr = drs?.[0];
      if (!dr) return json({ success: false, message: 'Delivery request not found' }, 404);
      if (dr.seller_id !== user.id) return json({ success: false, message: 'Only seller can approve' }, 403);
      if (dr.status !== 'pending') return json({ success: false, message: `Cannot approve: status is ${dr.status}` }, 400);

      // Check if expired
      if (new Date(dr.expires_at) < new Date()) {
        await adminClient.from('delivery_requests').update({ status: 'expired' }).eq('id', dr.id);
        if (dr.order_id) {
          await adminClient.from('orders').update({ delivery_type: 'standard', delivery_price: 20 }).eq('id', dr.order_id);
        }
        return json({ success: false, message: 'Delivery request has expired' }, 400);
      }

      // Approve
      await adminClient.from('delivery_requests').update({ status: 'approved' }).eq('id', dr.id);
      if (dr.order_id) {
        await adminClient.from('orders').update({ status: 'approved' }).eq('id', dr.order_id);
      }

      // Notify buyer
      await adminClient.from('notifications').insert({
        user_id: dr.buyer_id,
        type: 'delivery_approved',
        title: '24-Hour Delivery Approved!',
        message: 'The seller has approved your 24-hour delivery request. You can now complete payment.',
        data: { delivery_request_id: dr.id, order_id: dr.order_id },
      });

      return json({ success: true, message: '24-hour delivery approved', data: { delivery_request_id: dr.id, order_id: dr.order_id } });
    }

    // ---- DECLINE DELIVERY REQUEST (Seller only) ----
    if (action === 'decline') {
      if (req.method !== 'POST') return json({ success: false, message: 'POST required' }, 405);

      const body = await req.json();
      const { delivery_request_id } = body;
      if (!delivery_request_id) return json({ success: false, message: 'delivery_request_id required' }, 400);

      const { data: drs, error: drError } = await adminClient
        .from('delivery_requests')
        .select('*')
        .eq('id', delivery_request_id);

      if (drError) throw drError;
      const dr = drs?.[0];
      if (!dr) return json({ success: false, message: 'Delivery request not found' }, 404);
      if (dr.seller_id !== user.id) return json({ success: false, message: 'Only seller can decline' }, 403);
      if (dr.status !== 'pending') return json({ success: false, message: `Cannot decline: status is ${dr.status}` }, 400);

      // Decline
      await adminClient.from('delivery_requests').update({ status: 'declined' }).eq('id', dr.id);
      // Fallback to standard delivery
      if (dr.order_id) {
        await adminClient.from('orders').update({ delivery_type: 'standard', delivery_price: 20 }).eq('id', dr.order_id);
      }

      // Notify buyer
      await adminClient.from('notifications').insert({
        user_id: dr.buyer_id,
        type: 'delivery_declined',
        title: '24-Hour Delivery Declined',
        message: 'The seller has declined your 24-hour delivery request. Standard delivery will be used.',
        data: { delivery_request_id: dr.id, order_id: dr.order_id },
      });

      return json({ success: true, message: 'Delivery request declined, order changed to standard delivery' });
    }

    // ---- CHECK STATUS ----
    if (action === 'status') {
      const drId = url.searchParams.get('id');
      const orderId = url.searchParams.get('order_id');

      if (!drId && !orderId) return json({ success: false, message: 'id or order_id required' }, 400);

      let query = adminClient
        .from('delivery_requests')
        .select('*, orders(status, delivery_type, delivery_price)')
        .order('created_at', { ascending: false });

      if (drId) query = query.eq('id', drId);
      else query = query.eq('order_id', orderId);

      const { data: requests, error } = await query;

      if (error) throw error;
      if (!requests || requests.length === 0) return json({ success: false, message: 'No delivery requests found' }, 404);

      // Process all requests for expiry
      const now = new Date();
      const processed = await Promise.all(requests.map(async (dr: any) => {
        if (dr.status === 'pending' && new Date(dr.expires_at) < now) {
          await adminClient.from('delivery_requests').update({ status: 'expired' }).eq('id', dr.id);
          dr.status = 'expired';
        }

        const expiresAt = new Date(dr.expires_at);
        const remainingMs = Math.max(0, expiresAt.getTime() - now.getTime());
        return {
          ...dr,
          remaining_seconds: Math.floor(remainingMs / 1000),
          is_expired: remainingMs <= 0,
        };
      }));

      // Return array if order_id was used, or single object if id was used
      return json({
        success: true,
        data: drId ? processed[0] : processed
      });
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
