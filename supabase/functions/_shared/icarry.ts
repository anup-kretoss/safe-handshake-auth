// Shared iCarry integration logic
// Used by mamo-payment, mamo-webhook, and icarry edge functions

const ICARRY_BASE = 'https://uae.icarry.com';
const ICARRY_EMAIL = 'Info@souk-it.com';
const ICARRY_PASSWORD = 'Dayslane_2311';

// UAE state IDs (from iCarry's country API)
// NOTE: Currently only Dubai (1841) has active carriers (Quiqup)
// All other emirates fall back to Dubai for carrier availability
const UAE_STATES: Record<string, number> = {
  'dubai': 1841,
  'abu dhabi': 1839,
  'sharjah': 1842,
  'ajman': 1840,
  'ras al khaimah': 1843,
  'fujairah': 1844,
  'umm al quwain': 1845,
};


function getStateId(city: string): number {
  const lower = (city || '').toLowerCase();
  for (const [name, id] of Object.entries(UAE_STATES)) {
    if (lower.includes(name)) return id;
  }
  return 1841; // default Dubai
}

// For rate estimation, always use Dubai state IDs since that's where
// active carriers (Quiqup) operate. The actual delivery address is still
// passed correctly in the shipment payload.
function getRateStateId(city: string): number {
  const lower = (city || '').toLowerCase();
  if (lower.includes('dubai')) return 1841;
  // For non-Dubai cities, still try Dubai rates — carrier may still service them
  return 1841;
}

export async function getIcarryToken(): Promise<string> {
  const res = await fetch(`${ICARRY_BASE}/api-frontend/Authenticate/GetTokenForCustomerApi`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ Email: ICARRY_EMAIL, Password: ICARRY_PASSWORD }),
  });
  if (!res.ok) throw new Error(`iCarry auth failed: ${res.status}`);
  const data = await res.json();
  if (!data.token) throw new Error(`iCarry auth failed: ${JSON.stringify(data)}`);
  return data.token;
}

async function icarryFetch(method: string, path: string, token: string, body?: unknown): Promise<any> {
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
  if (!res.ok) throw new Error(`iCarry ${method} ${path} (${res.status}): ${text}`);
  return data;
}

async function getFirstRate(token: string, pickupStateId: number, dropStateId: number): Promise<{
  SystemShipmentProvider: string;
  MethodName: string;
  MethodDescription: string;
  Price: number;
} | null> {
  try {
    const data = await icarryFetch('POST', '/api-frontend/SmartwareShipment/EstimateRates', token, {
      PickupCountryId: 234,
      PickupStateProvinceId: pickupStateId,
      PickupPostalCode: '',
      FromLongitude: 0,
      FromLatitude: 0,
      dropCountryId: 234,
      dropsStateProvinceId: dropStateId,
      dropPostalCode: '',
      ToLongitude: 0,
      ToLatitude: 0,
      ActualWeight: 1,
      PackageType: 'Parcel',
      dimensions: { Length: 20, Width: 20, Height: 10, Unit: 'cm' },
      IsVendor: false,
      CODCurrency: null,
      CODAmount: 0,
    });

    const options: any[] = data?.ShippingOptions || [];
    if (options.length === 0) return null;

    // Pick cheapest available option
    const sorted = options.sort((a, b) => (a.Rate || 0) - (b.Rate || 0));
    const opt = sorted[0];
    return {
      SystemShipmentProvider: opt.ShippingRateComputationMethodSystemName || opt.CarrierModel?.SystemName || '',
      MethodName: opt.MethodName || opt.Name || '',
      MethodDescription: opt.MethodName || opt.Name || '',
      Price: opt.Rate || 0,
    };
  } catch (e: any) {
    console.error('[iCarry] getFirstRate failed:', e.message);
    return null;
  }
}

export async function createIcarryOrder(adminClient: any, orderId: string): Promise<void> {
  const { data: order } = await adminClient
    .from('orders')
    .select('*, products(id, title, price)')
    .eq('id', orderId)
    .maybeSingle();

  if (!order) { console.error('[iCarry] order not found:', orderId); return; }
  if (order.icarry_order_id) { console.log('[iCarry] already created for order:', orderId); return; }

  const [{ data: buyerProfile }, { data: sellerProfile }] = await Promise.all([
    adminClient.from('profiles').select('*').eq('user_id', order.buyer_id).maybeSingle(),
    adminClient.from('profiles').select('*').eq('user_id', order.seller_id).maybeSingle(),
  ]);

  const token = await getIcarryToken();

  const shipping = order.shipping_address || {};
  const pickup = sellerProfile?.collection_address || {};

  const buyerCity = shipping.town_city || 'Dubai';
  const sellerCity = pickup.town_city || 'Dubai';
  const dropStateId = getStateId(buyerCity);
  const pickupStateId = getStateId(sellerCity);

  // For rate lookup, use Dubai IDs — only active carrier (Quiqup) operates there
  // The actual delivery address is still passed correctly in the shipment payload
  const ratePickupStateId = getRateStateId(sellerCity);
  const rateDropStateId = getRateStateId(buyerCity);
  const rate = await getFirstRate(token, ratePickupStateId, rateDropStateId);

  if (!rate) {
    // No carriers available for this route — log and skip (don't fail the payment)
    console.error(`[iCarry] No carriers available for route ${sellerCity} → ${buyerCity}. Skipping iCarry order creation.`);
    // Still mark as shipped so order flow continues — admin can manually create shipment
    await adminClient.from('orders').update({
      icarry_order_id: 'NO_CARRIER',
      icarry_tracking_number: '',
      icarry_tracking_url: '',
      status: 'paid', // keep as paid, not shipped — needs manual handling
      updated_at: new Date().toISOString(),
    }).eq('id', orderId);
    await adminClient.from('notifications').insert({
      user_id: order.buyer_id,
      type: 'order_update',
      title: 'Order confirmed',
      message: `Your order for "${order.products?.title}" is confirmed. Shipping will be arranged shortly.`,
      data: { order_id: orderId },
    });
    return;
  }

  const buyerName = (buyerProfile?.full_name ||
    `${buyerProfile?.first_name || ''} ${buyerProfile?.last_name || ''}`.trim() || 'Buyer').split(' ');
  const sellerName = (sellerProfile?.full_name ||
    `${sellerProfile?.first_name || ''} ${sellerProfile?.last_name || ''}`.trim() || 'Souk IT').split(' ');

  // Use order-scoped noreply emails to avoid iCarry duplicate customer constraint
  const orderShort = orderId.replace(/-/g, '').substring(0, 8);
  const pickupEmail = `pickup-${orderShort}@souk-it-orders.com`;
  const dropoffEmail = `dropoff-${orderShort}@souk-it-orders.com`;

  const payload: any = {
    createAccount: false,
    notifyByEmail: false,
    pickupAddress: {
      FirstName: sellerName[0] || 'Souk',
      LastName: sellerName.slice(1).join(' ') || 'IT',
      Email: pickupEmail,
      PhoneNumber: sellerProfile?.phone_number || '+971585968861',
      CountryId: 234,
      StateProvinceId: pickupStateId,
      Address1: pickup.address || 'Dubai, UAE',
      Address2: '',
      ZipPostalCode: pickup.postcode || '',
    },
    dropOffAddress: {
      FirstName: buyerName[0] || 'Buyer',
      LastName: buyerName.slice(1).join(' ') || 'User',
      Email: dropoffEmail,
      PhoneNumber: shipping.phone_number || buyerProfile?.phone_number || '+971501234567',
      CountryId: 234,
      StateProvinceId: dropStateId,
      Address1: shipping.address || 'Dubai, UAE',
      Address2: '',
      ZipPostalCode: shipping.postcode || '',
    },
    ActualWeight: 1,
    PackageType: 'Parcel',
    Length: 20,
    Width: 20,
    Height: 10,
    Notes: `Souk IT Order #${orderId} — ${order.products?.title || 'Item'}`,
    ParcelQuantity: 1,
    ParcelCurrency: 'AED',
    ParcelPackageValue: order.products?.price || 0,
    ParcelDescription: order.products?.title || 'Marketplace Item',
  };

  if (rate) {
    payload.SystemShipmentProvider = rate.SystemShipmentProvider;
    payload.MethodName = rate.MethodName;
    payload.MethodDescription = rate.MethodDescription;
    payload.Price = rate.Price;
    console.log(`[iCarry] using carrier: ${rate.SystemShipmentProvider}, price: ${rate.Price}`);
  } else {
    console.log('[iCarry] no rates found, submitting without carrier selection');
  }

  console.log(`[iCarry] calling CreateOnDemandShipment for order ${orderId}`);
  const result = await icarryFetch('POST', '/api-frontend/SmartwareShipment/CreateOnDemandShipment', token, payload);
  console.log(`[iCarry] response:`, JSON.stringify(result).substring(0, 300));

  // Extract shipment ID and tracking number from response
  const icarryOrderId = String(result?.Id || result?.id || result?.ShipmentId || result?.shipment_id || '');
  const trackingNumber = result?.TrackingNumber || result?.tracking_number ||
    result?.CustomOrderNumber || result?.AWB || icarryOrderId;
  const trackingUrl = `${ICARRY_BASE}/api-frontend/SmartwareShipment/orderTracking?trackingNumber=${trackingNumber}`;

  console.log(`[iCarry] shipment created. ID: ${icarryOrderId}, Tracking: ${trackingNumber}`);

  await adminClient.from('orders').update({
    icarry_order_id: icarryOrderId,
    icarry_tracking_number: String(trackingNumber || ''),
    icarry_tracking_url: trackingUrl,
    status: 'shipped',
    updated_at: new Date().toISOString(),
  }).eq('id', orderId);

  await adminClient.from('notifications').insert({
    user_id: order.buyer_id,
    type: 'order_shipped',
    title: 'Your order has been shipped!',
    message: `"${order.products?.title}" is on its way via iCarry. Tracking: ${trackingNumber}`,
    data: { order_id: orderId, icarry_tracking_number: String(trackingNumber || ''), icarry_tracking_url: trackingUrl },
  });
}
