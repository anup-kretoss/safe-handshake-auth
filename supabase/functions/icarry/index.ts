import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getIcarryToken, createIcarryOrder } from "../_shared/icarry.ts";

const ICARRY_BASE = "https://uae.icarry.com";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

async function icarryReq(method: string, path: string, token: string, body?: unknown): Promise<any> {
  const res = await fetch(`${ICARRY_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) throw new Error(`iCarry ${path} (${res.status}): ${text}`);
  return data;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action') || '';

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || serviceRoleKey;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const getUser = async () => {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) return null;
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      return user;
    };

    // ---- TEST AUTH ----
    if (action === 'get-token') {
      const token = await getIcarryToken();
      return json({ success: true, message: 'iCarry authenticated successfully', token_preview: token.substring(0, 30) + '...' });
    }

    // ---- GET WAREHOUSES ----
    if (action === 'get-warehouses') {
      const token = await getIcarryToken();
      const data = await icarryReq('GET', '/api-frontend/Warehouse/GetAll', token);
      return json({ success: true, data });
    }

    // ---- CREATE WAREHOUSE ----
    if (action === 'create-warehouse') {
      if (req.method !== 'POST') return json({ success: false, message: 'POST required' }, 405);
      const body = await req.json();
      const token = await getIcarryToken();
      const data = await icarryReq('POST', '/api-frontend/Warehouse/createWarehouseForMarketPlace', token, body);
      return json({ success: true, data });
    }

    // ---- GET RATES ----
    if (action === 'get-rates') {
      const body = req.method === 'POST' ? await req.json() : {};
      const token = await getIcarryToken();
      const payload = {
        pickupLocation: body.pickupLocation || 'Souk IT',
        CODAmount: 0,
        COdCurrency: 'AED',
        DropOffLocation: body.dropCity || 'Dubai',
        ToLongitude: body.toLongitude || 55.2708,
        ToLatitude: body.toLatitude || 25.2048,
        ActualWeight: body.weight || 1,
        Dimensions: { Length: body.length || 20, Width: body.width || 20, Height: body.height || 10 },
        PackageType: 'Parcel',
        DropAddress: { CountryCode: 'AE', City: body.dropCity || 'Dubai' },
        ParcelDimensionsList: [{ Quantity: 1, Weight: body.weight || 1, Length: 20, Width: 20, Height: 10 }],
      };
      const data = await icarryReq('POST', '/api-frontend/SmartwareShipment/EstimateRatesForMarketplace', token, payload);
      return json({ success: true, data });
    }

    // ---- CREATE ORDER ----
    if (action === 'create-order') {
      if (req.method !== 'POST') return json({ success: false, message: 'POST required' }, 405);
      const user = await getUser();
      if (!user) return json({ success: false, message: 'Unauthorized' }, 401);
      const { order_id } = await req.json();
      if (!order_id) return json({ success: false, message: 'order_id is required' }, 400);
      const { data: order } = await adminClient.from('orders').select('buyer_id, seller_id, status').eq('id', order_id).maybeSingle();
      if (!order) return json({ success: false, message: 'Order not found' }, 404);
      if (order.buyer_id !== user.id && order.seller_id !== user.id) return json({ success: false, message: 'Not authorized' }, 403);
      if (order.status !== 'paid') return json({ success: false, message: `Order must be paid first. Status: "${order.status}"` }, 400);
      await createIcarryOrder(adminClient, order_id);
      const { data: updated } = await adminClient.from('orders').select('icarry_order_id, icarry_tracking_number, icarry_tracking_url').eq('id', order_id).maybeSingle();
      return json({ success: true, message: 'iCarry order created successfully', data: { order_id, ...updated } });
    }

    // ---- TRACK ----
    if (action === 'track') {
      const tn = url.searchParams.get('tracking_number');
      const orderId = url.searchParams.get('order_id');
      let trackingNum = tn;
      if (!trackingNum && orderId) {
        const { data: o } = await adminClient.from('orders').select('icarry_tracking_number').eq('id', orderId).maybeSingle();
        trackingNum = o?.icarry_tracking_number;
      }
      if (!trackingNum) return json({ success: false, message: 'tracking_number or order_id required' }, 400);
      const token = await getIcarryToken();
      const data = await icarryReq('GET', `/api-frontend/SmartwareShipment/orderTracking?trackingNumber=${encodeURIComponent(trackingNum)}`, token);
      return json({ success: true, data: { tracking_number: trackingNum, tracking: data } });
    }

    // ---- CANCEL ----
    if (action === 'cancel') {
      const user = await getUser();
      if (!user) return json({ success: false, message: 'Unauthorized' }, 401);
      const tn = url.searchParams.get('tracking_number');
      const orderId = url.searchParams.get('order_id');
      let trackingNum = tn;
      if (!trackingNum && orderId) {
        const { data: o } = await adminClient.from('orders').select('icarry_tracking_number').eq('id', orderId).maybeSingle();
        trackingNum = o?.icarry_tracking_number;
      }
      if (!trackingNum) return json({ success: false, message: 'tracking_number or order_id required' }, 400);
      const token = await getIcarryToken();
      const data = await icarryReq('GET', `/api-frontend/SmartwareShipment/CancelOrder?trackingNumber=${encodeURIComponent(trackingNum)}`, token);
      return json({ success: true, message: 'iCarry order cancelled', data });
    }

    // ---- GET LABEL ----
    if (action === 'get-label') {
      const shipmentId = url.searchParams.get('shipment_id');
      if (!shipmentId) return json({ success: false, message: 'shipment_id is required' }, 400);
      const token = await getIcarryToken();
      const data = await icarryReq('GET', `/api-frontend/SmartwareShipment/PdfPackagingSlip/${shipmentId}`, token);
      return json({ success: true, data });
    }

    return json({ success: false, message: 'Unknown action. Valid: get-token, get-warehouses, create-warehouse, get-rates, create-order, track, cancel, get-label' }, 400);

  } catch (err: any) {
    console.error('[icarry]', err.message);
    return json({ success: false, message: err.message || 'Internal server error' }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
