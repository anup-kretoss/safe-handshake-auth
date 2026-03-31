import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, GET, PUT, DELETE, OPTIONS',
};

const COL = {
  pickup:   'collection_address',
  delivery: 'delivery_address',
} as const;

type AddrType = keyof typeof COL;

function toArray(raw: any): any[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'object') return [{ id: 'legacy', ...raw }];
  return [];
}

/**
 * Checks whether any non-delivered orders are linked to the given address.
 * For delivery type  → checks buyer orders matched by shipping_address fields.
 * For pickup type    → checks seller orders (any non-delivered order blocks the action).
 * Returns null if safe to proceed, or an error response object if blocked.
 */
async function checkActiveOrders(
  adminClient: any,
  userId: string,
  type: AddrType,
  addrToCheck: any,
  address_id: string,
): Promise<{ blocked: true; response: any } | { blocked: false }> {
  // Every status except 'delivered' is considered active / in-approval
  const blockedStatuses = ['pending', 'approved', 'paid', 'shipped', 'cancelled'];

  if (type === 'delivery') {
    const { data: buyerOrders, error } = await adminClient
      .from('orders')
      .select('id, status, shipping_address')
      .eq('buyer_id', userId)
      .not('status', 'eq', 'delivered');

    if (error) throw error;

    const linked = (buyerOrders || []).filter((o: any) => {
      const sa = o.shipping_address;
      if (!sa) return false;
      // Match by stored address_id first, then fall back to field comparison
      if (sa.id && sa.id === address_id) return true;
      return (
        sa.address   === addrToCheck.address &&
        sa.town_city === addrToCheck.town_city &&
        sa.postcode  === addrToCheck.postcode
      );
    });

    if (linked.length > 0) {
      return {
        blocked: true,
        response: {
          success: false,
          message: `Cannot modify this address as it is used with ${linked.length} active order(s). All linked orders must be delivered before making changes.`,
          data: {
            order_ids: linked.map((o: any) => o.id),
            orders: linked.map((o: any) => ({ order_id: o.id, status: o.status })),
          },
        },
      };
    }
  }

  if (type === 'pickup') {
    // Block if ANY product is using this pickup address — regardless of orders
    const { data: linkedProducts, error: prodErr } = await adminClient
      .from('products')
      .select('id, title')
      .eq('seller_id', userId)
      .contains('pickup_address', { pickup_address_id: address_id });

    if (prodErr) throw prodErr;

    if (linkedProducts && linkedProducts.length > 0) {
      return {
        blocked: true,
        response: {
          success: false,
          message: `Cannot delete this pickup address as it is currently used by ${linkedProducts.length} product(s). Please update or remove those products first.`,
          data: {
            product_ids: linkedProducts.map((p: any) => p.id),
            products: linkedProducts.map((p: any) => ({ product_id: p.id, title: p.title })),
          },
        },
      };
    }
  }

  return { blocked: false };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl    = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ success: false, message: 'Unauthorized' }, 401);

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const token = authHeader.replace('Bearer ', '').trim();
    const { data: { user }, error: authError } = await adminClient.auth.getUser(token);
    if (authError || !user) return json({ success: false, message: 'Invalid JWT or session expired' }, 401);

    const url    = new URL(req.url);
    const action = url.searchParams.get('action') || 'get';

    // ------------------------------------------------------------------ GET --
    if (action === 'get') {
      const typeFilter = url.searchParams.get('type') as AddrType | null;

      const { data: profile, error } = await adminClient
        .from('profiles')
        .select('collection_address, delivery_address')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;

      const pickupAddresses   = toArray(profile?.collection_address);
      const deliveryAddresses = toArray(profile?.delivery_address);

      if (typeFilter === 'pickup') {
        return json({ success: true, data: { type: 'pickup', addresses: pickupAddresses } });
      }
      if (typeFilter === 'delivery') {
        return json({ success: true, data: { type: 'delivery', addresses: deliveryAddresses } });
      }

      return json({
        success: true,
        data: { pickup_addresses: pickupAddresses, delivery_addresses: deliveryAddresses },
      });
    }

    // ------------------------------------------------------------------ ADD --
    if (action === 'add') {
      if (req.method !== 'POST') return json({ success: false, message: 'POST required' }, 405);

      const body = await req.json();
      const { type, address, town_city, postcode, label } = body;

      if (!type || !['pickup', 'delivery'].includes(type)) {
        return json({ success: false, message: 'type must be pickup or delivery' }, 400);
      }
      if (!address || !town_city || !postcode) {
        return json({ success: false, message: 'address, town_city, and postcode are required' }, 400);
      }

      const col = COL[type as AddrType];

      const { data: profile, error: fetchErr } = await adminClient
        .from('profiles')
        .select(col)
        .eq('user_id', user.id)
        .single();

      if (fetchErr) throw fetchErr;

      const existing = toArray(profile?.[col]);
      const newAddr  = {
        id:         crypto.randomUUID(),
        address,
        town_city,
        postcode,
        label:      label || null,
        created_at: new Date().toISOString(),
      };
      const updated = [...existing, newAddr];

      const { error: updateErr } = await adminClient
        .from('profiles')
        .update({ [col]: updated })
        .eq('user_id', user.id);

      if (updateErr) throw updateErr;

      return json({
        success: true,
        message: `${type} address added successfully`,
        data: { address: newAddr, addresses: updated },
      });
    }

    // --------------------------------------------------------------- UPDATE --
    if (action === 'update') {
      if (req.method !== 'POST') return json({ success: false, message: 'POST required' }, 405);

      const body = await req.json();
      const { type, address_id, address, town_city, postcode, label } = body;

      if (!type || !['pickup', 'delivery'].includes(type)) {
        return json({ success: false, message: 'type must be pickup or delivery' }, 400);
      }
      if (!address_id) return json({ success: false, message: 'address_id is required' }, 400);
      if (!address || !town_city || !postcode) {
        return json({ success: false, message: 'address, town_city, and postcode are required' }, 400);
      }

      const col = COL[type as AddrType];

      const { data: profile, error: fetchErr } = await adminClient
        .from('profiles')
        .select(col)
        .eq('user_id', user.id)
        .single();

      if (fetchErr) throw fetchErr;

      const existing = toArray(profile?.[col]);
      const idx = existing.findIndex((a: any) => a.id === address_id);
      if (idx === -1) return json({ success: false, message: 'Address not found' }, 404);

      // Block update if any non-delivered order is linked to this address
      const guard = await checkActiveOrders(adminClient, user.id, type as AddrType, existing[idx], address_id);
      if (guard.blocked) return json(guard.response, 409);

      existing[idx] = {
        ...existing[idx],
        address,
        town_city,
        postcode,
        label:      label !== undefined ? label : existing[idx].label,
        updated_at: new Date().toISOString(),
      };

      const { error: updateErr } = await adminClient
        .from('profiles')
        .update({ [col]: existing })
        .eq('user_id', user.id);

      if (updateErr) throw updateErr;

      return json({
        success: true,
        message: `${type} address updated successfully`,
        data: { address: existing[idx], addresses: existing },
      });
    }

    // --------------------------------------------------------------- DELETE --
    if (action === 'delete') {
      if (req.method !== 'POST' && req.method !== 'DELETE') {
        return json({ success: false, message: 'POST or DELETE required' }, 405);
      }

      const body = await req.json();
      const { type, address_id } = body;

      if (!type || !['pickup', 'delivery'].includes(type)) {
        return json({ success: false, message: 'type must be pickup or delivery' }, 400);
      }
      if (!address_id) return json({ success: false, message: 'address_id is required' }, 400);

      const col = COL[type as AddrType];

      const { data: profile, error: fetchErr } = await adminClient
        .from('profiles')
        .select(col)
        .eq('user_id', user.id)
        .single();

      if (fetchErr) throw fetchErr;

      const existing = toArray(profile?.[col]);
      const addrToDelete = existing.find((a: any) => a.id === address_id);
      if (!addrToDelete) return json({ success: false, message: 'Address not found' }, 404);

      // Block delete if any non-delivered order is linked to this address
      const guard = await checkActiveOrders(adminClient, user.id, type as AddrType, addrToDelete, address_id);
      if (guard.blocked) return json(guard.response, 409);

      const filtered = existing.filter((a: any) => a.id !== address_id);
      const toStore  = filtered.length === 0 ? null : filtered;

      const { error: updateErr } = await adminClient
        .from('profiles')
        .update({ [col]: toStore })
        .eq('user_id', user.id);

      if (updateErr) throw updateErr;

      return json({
        success: true,
        message: `${type} address deleted successfully`,
        data: { addresses: filtered },
      });
    }

    return json({ success: false, message: 'Invalid action. Use: get, add, update, delete' }, 400);
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
